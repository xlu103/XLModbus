/**
 * UI交互处理
 */
document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const form = document.getElementById('modbusForm');
    const slaveAddress = document.getElementById('slaveAddress');
    const functionCode = document.getElementById('functionCode');
    const startAddress = document.getElementById('startAddress');
    const dataValue = document.getElementById('dataValue');
    const generateBtn = document.getElementById('generateBtn');
    const messageDisplay = document.getElementById('messageDisplay');
    const messageComment = document.getElementById('messageComment');
    const copyBtn = document.getElementById('copyBtn');
    const historyContainer = document.getElementById('historyContainer');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    // 数据转换相关元素
    const decValue = document.getElementById('decValue');
    const dataFormat = document.getElementById('dataFormat');
    const convertBtn = document.getElementById('convertBtn');
    const clearDataBtn = document.getElementById('clearDataBtn');
    const byteOrderInputs = document.querySelectorAll('input[name="byteOrder"]');
    const quickValues = document.querySelectorAll('.quick-value');

    // 从localStorage加载历史记录
    let messageHistory = JSON.parse(localStorage.getItem('modbusHistory') || '[]');

    // 数据格式转换函数
    const DataConverter = {
        // 将数字转换为指定字节数的十六进制字节数组
        numberToBytes: function(num, byteCount) {
            const bytes = [];
            for (let i = 0; i < byteCount; i++) {
                bytes.push((num >> (8 * (byteCount - 1 - i))) & 0xFF);
            }
            return bytes;
        },

        // 处理字节序
        reorderBytes: function(bytes, order) {
            switch (order) {
                case 'abcd': return bytes;
                case 'dcba': return bytes.reverse();
                case 'badc': return [bytes[1], bytes[0], bytes[3], bytes[2]];
                case 'cdab': return [bytes[2], bytes[3], bytes[0], bytes[1]];
                default: return bytes;
            }
        },

        // 转换浮点数为字节数组
        floatToBytes: function(num) {
            const buffer = new ArrayBuffer(4);
            new Float32Array(buffer)[0] = num;
            return Array.from(new Uint8Array(buffer));
        },

        // 转换各种格式
        convert: function(value, format, byteOrder) {
            let bytes;
            const num = parseFloat(value);

            switch (format) {
                case 'uint16':
                    if (num < 0 || num > 65535) throw new Error('UINT16 范围：0 到 65535');
                    bytes = this.numberToBytes(num, 2);
                    break;

                case 'int16':
                    if (num < -32768 || num > 32767) throw new Error('INT16 范围：-32768 到 32767');
                    bytes = this.numberToBytes(num < 0 ? num + 65536 : num, 2);
                    break;

                case 'uint32':
                    if (num < 0 || num > 4294967295) throw new Error('UINT32 范围：0 到 4294967295');
                    bytes = this.numberToBytes(num, 4);
                    break;

                case 'int32':
                    if (num < -2147483648 || num > 2147483647) throw new Error('INT32 范围：-2147483648 到 2147483647');
                    bytes = this.numberToBytes(num < 0 ? num + 4294967296 : num, 4);
                    break;

                case 'float':
                    bytes = this.floatToBytes(num);
                    break;

                default:
                    throw new Error('不支持的数据格式');
            }

            // 处理字节序
            bytes = this.reorderBytes(bytes, byteOrder);
            
            // 转换为十六进制字符串
            return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        }
    };

    // 执行转换
    function performConversion() {
        try {
            const value = decValue.value;
            const format = dataFormat.value;
            const byteOrder = document.querySelector('input[name="byteOrder"]:checked').value;

            if (!value) {
                throw new Error('请输入数值');
            }

            const result = DataConverter.convert(value, format, byteOrder);
            
            // 将结果添加到当前数据值
            const currentValue = dataValue.value.trim();
            dataValue.value = currentValue ? currentValue + ' ' + result : result;

            // 清空输入
            decValue.value = '';

        } catch (error) {
            alert(error.message);
        }
    }

    // 显示历史记录
    function displayHistory() {
        historyContainer.innerHTML = messageHistory.map((item, index) => `
            <div class="history-item" data-index="${index}">
                <div class="history-timestamp">${new Date(item.timestamp).toLocaleString()}</div>
                <div class="message-text">
                    <span class="slave-address">${item.parts.slaveAddress}</span>
                    <span class="function-code">${item.parts.functionCode}</span>
                    <span class="register-address">${item.parts.registerAddress}</span>
                    <span class="data-content">${item.parts.content}</span>
                    <span class="crc">${item.parts.crc}</span>
                    ${item.comment ? `<span class="message-comment"># ${item.comment}</span>` : ''}
                </div>
                <div class="mt-2">
                    <button class="btn btn-sm btn-outline-primary copy-history-btn">复制</button>
                    <button class="btn btn-sm btn-outline-secondary load-history-btn">加载</button>
                    <button class="btn btn-sm btn-outline-danger delete-history-btn">删除</button>
                </div>
            </div>
        `).join('');

        // 绑定历史记录按钮事件
        document.querySelectorAll('.copy-history-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const historyItem = e.target.closest('.history-item');
                const text = historyItem.querySelector('.message-text').textContent.trim();
                copyToClipboard(text);
            });
        });

        document.querySelectorAll('.load-history-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.history-item').dataset.index);
                loadHistoryItem(messageHistory[index]);
            });
        });

        document.querySelectorAll('.delete-history-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.history-item').dataset.index);
                messageHistory.splice(index, 1);
                saveHistory();
                displayHistory();
            });
        });
    }

    // 加载历史记录项到表单
    function loadHistoryItem(item) {
        slaveAddress.value = item.config.slaveAddress;
        functionCode.value = item.config.functionCode;
        startAddress.value = item.config.startAddress;
        dataValue.value = item.config.data;
        messageComment.value = item.comment || '';
        generateMessage();
    }

    // 保存历史记录
    function saveHistory() {
        localStorage.setItem('modbusHistory', JSON.stringify(messageHistory));
    }

    // 生成报文
    function generateMessage() {
        try {
            // 清除之前的错误状态
            [slaveAddress, functionCode, startAddress, dataValue].forEach(el => {
                el.classList.remove('is-invalid');
                const feedback = el.nextElementSibling;
                if (feedback && feedback.classList.contains('invalid-feedback')) {
                    feedback.remove();
                }
            });

            // 验证起始地址格式
            const startAddressValue = startAddress.value.trim().toUpperCase();
            if (!/^[0-9A-F]{1,4}$/.test(startAddressValue)) {
                throw new Error('起始地址必须是1-4位的十六进制数字');
            }

            // 获取表单数据
            const config = {
                slaveAddress: parseInt(slaveAddress.value),
                functionCode: functionCode.value,
                startAddress: startAddressValue.padStart(4, '0'),
                data: dataValue.value
            };

            // 生成报文
            const message = ModbusMessage.generate(config);

            // 显示报文
            displayMessage(message);

            // 添加到历史记录
            const historyItem = {
                timestamp: new Date().getTime(),
                config: config,
                parts: message.parts,
                comment: messageComment.value
            };

            messageHistory.unshift(historyItem);
            if (messageHistory.length > 50) { // 限制历史记录数量
                messageHistory.pop();
            }
            saveHistory();
            displayHistory();

        } catch (error) {
            // 显示错误信息
            const targetInput = error.message.includes('从机地址') ? slaveAddress :
                              error.message.includes('起始地址') ? startAddress :
                              error.message.includes('数据') ? dataValue : null;

            if (targetInput) {
                targetInput.classList.add('is-invalid');
                const feedback = document.createElement('div');
                feedback.className = 'invalid-feedback';
                feedback.textContent = error.message;
                targetInput.parentNode.appendChild(feedback);
            } else {
                alert(error.message);
            }
        }
    }

    // 显示报文
    function displayMessage(message) {
        const parts = message.parts;
        messageDisplay.innerHTML = `
            <span class="slave-address">${parts.slaveAddress}</span>
            <span class="function-code">${parts.functionCode}</span>
            <span class="register-address">${parts.registerAddress}</span>
            <span class="data-content">${parts.content}</span>
            <span class="crc">${parts.crc}</span>
            ${messageComment.value ? `<span class="message-comment"># ${messageComment.value}</span>` : ''}
        `;
    }

    // 复制到剪贴板
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = '已复制';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 1500);
        });
    }

    // 验证十六进制输入
    function validateHex(input, allowSpaces = true) {
        const value = input.value.trim();
        if (value === '') return;
        
        const pattern = allowSpaces ? /^[0-9A-Fa-f\s]+$/ : /^[0-9A-Fa-f]+$/;
        const isValid = pattern.test(value);
        input.classList.toggle('is-invalid', !isValid);
        
        let feedback = input.nextElementSibling;
        if (!isValid) {
            if (!feedback || !feedback.classList.contains('invalid-feedback')) {
                feedback = document.createElement('div');
                feedback.className = 'invalid-feedback';
                input.parentNode.appendChild(feedback);
            }
            feedback.textContent = allowSpaces ? 
                '请输入有效的十六进制数据（例如：01 02 03）' :
                '请输入有效的十六进制数字（0-9，A-F）';
        } else if (feedback && feedback.classList.contains('invalid-feedback')) {
            feedback.remove();
        }

        // 对于起始地址，自动转换为大写
        if (!allowSpaces) {
            input.value = value.toUpperCase();
        }
    }

    // 绑定事件
    generateBtn.addEventListener('click', generateMessage);
    copyBtn.addEventListener('click', () => {
        const text = messageDisplay.textContent.trim();
        copyToClipboard(text);
    });

    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('确定要清空所有历史记录吗？')) {
            messageHistory = [];
            saveHistory();
            displayHistory();
        }
    });

    // 数据转换相关事件
    convertBtn.addEventListener('click', performConversion);
    clearDataBtn.addEventListener('click', () => {
        dataValue.value = '';
        decValue.value = '';
    });

    // 快速值选择
    quickValues.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            const currentValue = dataValue.value.trim();
            dataValue.value = currentValue ? currentValue + ' ' + value : value;
        });
    });

    // 绑定输入验证
    dataValue.addEventListener('input', () => validateHex(dataValue, true));
    startAddress.addEventListener('input', () => validateHex(startAddress, false));

    // 根据功能码更新数据输入提示
    functionCode.addEventListener('change', function() {
        const code = this.value;
        let placeholder = '';
        
        switch (code) {
            case '01':
            case '02':
            case '03':
            case '04':
                placeholder = '输入要读取的数量（十进制）';
                break;
            case '05':
                placeholder = '输入 00 或 FF（FF=ON, 00=OFF）';
                break;
            case '06':
                placeholder = '输入寄存器值（如：00 01）';
                break;
            case '0F':
            case '10':
                placeholder = '输入多个值，用空格分隔（如：01 02 03）';
                break;
        }
        
        dataValue.placeholder = placeholder;
    });

    // 初始化
    functionCode.dispatchEvent(new Event('change'));
    displayHistory();
}); 