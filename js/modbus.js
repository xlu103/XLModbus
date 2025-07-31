/**
 * Modbus报文生成器
 */
const ModbusMessage = {
    /**
     * 将十六进制字符串转换为字节数组
     * @param {string} hex 十六进制字符串，如 "01 02 03"
     * @returns {Array} 字节数组
     */
    hexToBytes: function(hex) {
        return hex.trim().split(/\s+/).map(byte => parseInt(byte, 16));
    },

    /**
     * 将字节数组转换为十六进制字符串
     * @param {Array} bytes 字节数组
     * @returns {string} 十六进制字符串，如 "01 02 03"
     */
    bytesToHex: function(bytes) {
        return bytes.map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    },

    /**
     * 生成Modbus报文
     * @param {Object} config 配置对象
     * @param {number} config.slaveAddress 从机地址 (1-247)
     * @param {string} config.functionCode 功能码
     * @param {string} config.startAddress 起始地址 (0000-FFFF，十六进制)
     * @param {string} config.data 数据内容（十六进制字符串）
     * @returns {Object} 包含报文和各部分信息的对象
     */
    generate: function(config) {
        // 验证输入
        if (config.slaveAddress < 1 || config.slaveAddress > 247) {
            throw new Error('从机地址必须在1-247之间');
        }

        // 将起始地址从十六进制字符串转换为数值
        const startAddress = parseInt(config.startAddress, 16);
        if (isNaN(startAddress) || startAddress < 0 || startAddress > 0xFFFF) {
            throw new Error('起始地址必须是有效的十六进制数值（0000-FFFF）');
        }

        // 构建基本报文
        const message = [
            config.slaveAddress,                    // 从机地址
            parseInt(config.functionCode, 16)       // 功能码
        ];

        // 添加起始地址（高字节在前，低字节在后）
        message.push((startAddress >> 8) & 0xFF);
        message.push(startAddress & 0xFF);

        // 处理数据部分
        let data;
        switch (config.functionCode) {
            case '01': // 读线圈
            case '02': // 读离散输入
            case '03': // 读保持寄存器
            case '04': // 读输入寄存器
                // 对于读取命令，数据部分是数量（十进制输入，转换为两个字节）
                const count = parseInt(config.data || '1', 10);
                message.push((count >> 8) & 0xFF);  // 数量高字节
                message.push(count & 0xFF);         // 数量低字节
                break;
            
            case '05': // 写单个线圈
                // 对于写单个线圈，数据为 FF 00 (ON) 或 00 00 (OFF)
                const value = config.data.toUpperCase() === 'FF' ? 0xFF : 0x00;
                message.push(value);
                message.push(0x00);
                break;
            
            case '06': // 写单个寄存器
                // 写单个寄存器，直接使用十六进制数据
                data = this.hexToBytes(config.data);
                if (data.length !== 2) {
                    throw new Error('写单个寄存器需要2个字节的数据');
                }
                message.push(...data);
                break;
            
            case '0F': // 写多个线圈
            case '10': // 写多个寄存器
                // 写多个值，需要计算字节数
                data = this.hexToBytes(config.data);
                const byteCount = data.length;
                message.push((byteCount >> 8) & 0xFF);  // 数量高字节
                message.push(byteCount & 0xFF);         // 数量低字节
                message.push(byteCount);                // 字节数
                message.push(...data);                  // 数据
                break;
        }

        // 计算并添加CRC（低字节在前，高字节在后）
        const crc = CRC.calculate(message);
        message.push(...crc);

        // 构建带颜色标记的报文部分
        const parts = {
            slaveAddress: this.bytesToHex([message[0]]),
            functionCode: this.bytesToHex([message[1]]),
            registerAddress: this.bytesToHex(message.slice(2, 4)),
            content: this.bytesToHex(message.slice(4, -2)),
            crc: this.bytesToHex(message.slice(-2))
        };

        return {
            raw: message,
            hex: this.bytesToHex(message),
            parts: parts
        };
    }
}; 