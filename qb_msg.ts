
namespace qbuild {

    export namespace _msg {

        export enum MsgType {
            SYS = 0,
            CMD = 1,
            INFO = 2,
            DATA = 3,
        }

        export enum SysMsgType {
            SYNC = 0,
            NACK = 2,
            ACK = 4,
        }

        export enum CmdType {
            TYPE = 0,
            MODES = 1,
            SPEED = 2,
            SELECT = 3,
            WRITE = 4,
            EXT_MODE = 6,
            VERSION = 7,
        }

        export enum InfoType {
            NAME = 0,
            RAW = 1,
            PCT = 2,
            SI = 3,
            UNIT = 4,
            MAPPING = 5,
            COMBI = 6,
            FORMAT = 0x80,
        }

        export enum Consts {
            MODE_PLUS_8 = 0x20,
            MAX_DATA_LEN = 1 << 7,
        }

        export class Msg {

            buf: Buffer
            private head_len: number

            /**
             * 
             */
            constructor(msg_type: MsgType, sub_type: number = 0, mode: number = 0, data_len: number = 0) {

                if (MsgType.SYS == msg_type) {
                    let buf = pins.createBuffer(1)
                    buf.setUint8(0, sub_type)

                    this.buf = buf
                    this.head_len = 1
                    return
                }

                let len_e: number
                let len1: number
                do {
                    let a = getMsgLen(data_len)
                    len_e = a[0]
                    len1 = a[1]
                } while (false)

                const head_len = MsgType.INFO == msg_type ? 2 : 1

                let buf = pins.createBuffer(1 + head_len + len1)

                if (1 == head_len) {
                    let head: number
                    if (MsgType.CMD == msg_type) {
                        head = (msg_type << 6) | (len_e << 3) | (7 & sub_type)
                    } else { // DATA
                        head = (msg_type << 6) | (len_e << 3) | (7 & mode)
                    }
                    buf.setUint8(0, head)
                } else { // INFO
                    let head1 = (msg_type << 6) | (len_e << 3) | (7 & mode)
                    buf.setUint8(0, head1)

                    let head2 = sub_type
                    if (mode >= 8) {
                        head2 |= Consts.MODE_PLUS_8
                    }
                    buf.setUint8(1, head2)
                }

                this.buf = buf
                this.head_len = head_len
            }

            getMsgType(): MsgType {
                return this.buf.getUint8(0) >> 6
            }

            getSubType(): number {
                let head1 = this.buf.getUint8(0)
                let msg_type = head1 >> 6

                if (MsgType.DATA == msg_type) { return 0 }

                if (MsgType.SYS == msg_type || MsgType.CMD == msg_type) {
                    return 7 & head1
                } else {  // INFO 
                    let head2 = this.buf.getUint8(1)
                    return head2 & ~Consts.MODE_PLUS_8
                }
            }

            getDataLen(): number {
                let head1 = this.buf.getUint8(0)
                return 1 << (0x7 & (head1 >> 3))
            }

            getMode(): number {
                let head1 = this.buf.getUint8(0)
                let msg_type = head1 >> 6

                if (MsgType.SYS == msg_type || MsgType.CMD == msg_type) { return 0 }

                if (MsgType.INFO == msg_type) {
                    let mode = 7 & head1
                    let head2 = this.buf.getUint8(1)
                    if (head2 & Consts.MODE_PLUS_8) { mode += 8 }
                    return mode
                } else { // DATA
                    return 7 & head1
                }
            }

            getData(off: number, fmt: NumberFormat): number {
                return this.buf.getNumber(fmt, this.head_len + off)
            }

            setData(off: number, fmt: NumberFormat, value: number) {
                if (MsgType.SYS == this.getMsgType()) {
                    return
                }
                this.buf.setNumber(fmt, this.head_len + off, value)
            }

            setDataArray(off: number, fmt: NumberFormat, value: number[]) {
                if (MsgType.SYS == this.getMsgType()) {
                    return
                }

                const data_size = getDataSize(fmt);
                if (data_size <= 0) {
                    // TODO:
                    return
                }

                off += this.head_len
                for (let n of value) {
                    this.buf.setNumber(fmt, off, n)
                    off += data_size
                }
            }

            getDataUint8(off: number): number {
                if (MsgType.SYS == this.getMsgType()) {
                    return 0
                }
                return this.buf.getUint8(this.head_len + off)
            }

            setDataUint8(off: number, value: number) {
                if (MsgType.SYS == this.getMsgType()) {
                    return
                }
                this.buf.setUint8(this.head_len + off, value)
            }

            setDataStr(off: number, str: string) {
                if (MsgType.SYS == this.getMsgType()) {
                    return
                }

                for (let i = 0; i < str.length; i++) {
                    let off1 = this.head_len + off + i
                    if (off1 >= this.buf.length - 1) {
                        break
                    }
                    this.buf.setUint8(off1, str.charCodeAt(i))
                }

                if (this.head_len + off + str.length < this.buf.length - 1) {
                    this.buf.setUint8(this.head_len + off + str.length, 0)
                }
            }

            calcCrc(): number {
                if (MsgType.SYS == this.getMsgType()) {
                    return 0
                }

                let crc = 0xff
                for (let i = 0; i < this.buf.length - 1; i++) {
                    crc ^= this.buf.getUint8(i)
                }
                this.buf.setUint8(this.buf.length - 1, crc)

                return crc
            }

            getCrc(): number {
                if (MsgType.SYS == this.getMsgType()) {
                    return 0
                }
                return this.buf.getUint8(this.buf.length - 1)
            }

        }

        function getMsgLen(len: number): number[] {
            let len_e = 0
            let len1: number
            for (; len_e < 8; len_e++) {
                len1 = 1 << len_e
                if (len <= len1) {
                    break
                }
            } // for

            return [len_e, len1]
        }

        function getDataSize(fmt: NumberFormat): number {
            switch (fmt) {
                case NumberFormat.UInt8LE:
                case NumberFormat.UInt8BE:
                case NumberFormat.Int8LE:
                case NumberFormat.Int8BE:
                    return 1
                case NumberFormat.UInt16LE:
                case NumberFormat.UInt16BE:
                case NumberFormat.Int16LE:
                case NumberFormat.Int16BE:
                    return 2
                case NumberFormat.UInt32LE:
                case NumberFormat.UInt32BE:
                case NumberFormat.Int32LE:
                case NumberFormat.Int32BE:
                case NumberFormat.Float32LE:
                case NumberFormat.Float32BE:
                    return 4
            }// switch

            // Not supported
            return 0
        }

        export function createSysMsg(sys_type: SysMsgType) {
            return new Msg(MsgType.SYS, sys_type)
        }

        export function createCmdMsg(cmd_type: CmdType, data_len: number) {
            return new Msg(MsgType.CMD, cmd_type, 0, data_len)
        }

        export function createInfoMsg(info_type: InfoType, mode: number, data_len: number) {
            return new Msg(MsgType.INFO, info_type, mode, data_len)
        }

        export function createDataMsg(mode: number, data_len: number) {
            return new Msg(MsgType.DATA, 0, 7 & mode, data_len)
        }

        export enum DecodeResult {
            MSG_DECODED,
            NEED_DATA,
            MSG_ERROR,
        }

        enum DecodeStatus {
            NEED_HEAD1,
            NEED_HEAD2,
            NEED_MSG_DATA,
            NEED_CRC,
        }

        export class MsgDecoder {

            private status: DecodeStatus
            private buf: Buffer
            private buf_off: number
            private buf_size: number

            private head1: number
            private data_len: number
            private data_aquired: number
            private msg: Msg

            constructor() {
                this.status = DecodeStatus.NEED_HEAD1
                this.buf = pins.createBuffer(32)
                this.buf_off = 0
                this.buf_size = 0
            }

            reset() {
                this.status = DecodeStatus.NEED_HEAD1
                this.buf_off = 0
                this.buf_size = 0
            }

            feed(buf: Buffer) {
                if (!buf || 0 == buf.length) {
                    return
                }

                if (this.buf_remain() < buf.length && this.buf_off > 0) {
                    this.buf_shift()
                }

                let rem = this.buf_remain()
                if (rem < buf.length) {
                    let incr = buf.length - rem
                    if (incr < 4) {
                        incr = 4
                    }
                    this.buf_expand(incr)
                    rem = this.buf_remain()
                }

                this.buf.write(this.buf_off + this.buf_size, buf)
                this.buf_size += buf.length
            }

            decode(): DecodeResult {

                while (true) {
                    if (0 == this.buf_size) {
                        return DecodeResult.NEED_DATA
                    }

                    if (DecodeStatus.NEED_HEAD1 == this.status) {
                        let res = this.decode_HEAD1()
                        if (DecodeResult.MSG_DECODED == res) {
                            return res
                        }
                    } else if (DecodeStatus.NEED_HEAD2 == this.status) {
                        this.decode_HEAD2()
                    } else if (DecodeStatus.NEED_MSG_DATA == this.status) {
                        this.decode_DATA()
                    } else { // CRC

                        let res = this.decode_CRC()

                        if (this.buf.length > 256) {
                            this.buf_shrink()
                        }

                        return res
                    }

                } // while
            }

            getMsg(): Msg {
                return this.msg
            }

            private decode_HEAD1(): DecodeResult {

                let head1 = this.buf_fetchUint8()
                let msg_type = head1 >> 6
                let len_e = 7 & (head1 >> 3)
                let sub_type = 7 & head1

                if (MsgType.SYS == msg_type) {
                    // this.status = DecodeStatus.NEED_HEAD1 
                    this.msg = createSysMsg(sub_type)
                    return DecodeResult.MSG_DECODED
                }

                if (MsgType.INFO == msg_type) {
                    this.head1 = head1
                    this.status = DecodeStatus.NEED_HEAD2
                    return DecodeResult.NEED_DATA
                } else { // CMD, DATA
                    this.head1 = head1

                    let data_len = 1 << len_e
                    this.data_len = data_len
                    this.data_aquired = 0

                    if (MsgType.CMD == msg_type) {
                        this.msg = new Msg(msg_type, sub_type, 0, data_len)
                    } else { // DATA
                        this.msg = new Msg(msg_type, 0, sub_type, data_len)
                    }

                    this.status = DecodeStatus.NEED_MSG_DATA
                    return DecodeResult.NEED_DATA
                }
            }

            private decode_HEAD2(): DecodeResult {

                let head1 = this.head1
                let head2 = this.buf_fetchUint8()

                let msg_type = head1 >> 6
                let len_e = 7 & (head1 >> 3)
                let mode = 7 & head1

                let info_type = head2
                if (head2 & Consts.MODE_PLUS_8) {
                    mode += 8
                    info_type &= ~Consts.MODE_PLUS_8
                }

                let data_len = 1 << len_e
                this.msg = createInfoMsg(info_type, mode, data_len)
                this.data_len = data_len
                this.data_aquired = 0

                this.status = DecodeStatus.NEED_MSG_DATA
                return DecodeResult.NEED_DATA
            }

            private decode_DATA(): DecodeResult {

                let len = this.data_len - this.data_aquired
                if (this.buf_size < len) {
                    len = this.buf_size
                }

                for (let i = 0; i < len; i++) {
                    let n = this.buf.getUint8(this.buf_off + i)
                    this.msg.setDataUint8(this.data_aquired + i, n)
                }

                this.buf_consume(len)
                this.data_aquired += len

                this.status = this.data_len == this.data_aquired ? DecodeStatus.NEED_CRC : DecodeStatus.NEED_MSG_DATA
                return DecodeResult.NEED_DATA
            }

            private decode_CRC(): DecodeResult {
                let crc = this.buf_fetchUint8()
                let crc1 = this.msg.calcCrc()
                this.status = DecodeStatus.NEED_HEAD1
                if (crc == crc1) {
                    return DecodeResult.MSG_DECODED
                } else {
                    // this.status = DecodeStatus.NEED_HEAD1
                    return DecodeResult.MSG_ERROR
                }
            }

            private buf_fetchUint8(): number {
                let n = this.buf.getUint8(this.buf_off)
                this.buf_off++
                this.buf_size--
                if (0 == this.buf_size) {
                    this.buf_off = 0
                }

                return n
            }

            private buf_consume(size: number) {
                this.buf_off += size
                this.buf_size -= size
                if (0 == this.buf_size) {
                    this.buf_off = 0
                }
            }

            private buf_remain(): number {
                return this.buf.length - this.buf_off - this.buf_size
            }

            private buf_shift() {
                if (this.buf_off > 0) {
                    this.buf.shift(this.buf_off)
                    this.buf_off = 0
                }
            }

            private buf_expand(incr: number) {
                let buf1 = pins.createBuffer(this.buf.length + incr)
                if (0 == this.buf_remain()) {
                    buf1.write(0, this.buf)
                } else {
                    buf1.write(0, this.buf.slice(0, this.buf_off + this.buf_size))
                }
                this.buf = buf1
            }

            private buf_shrink() {

                this.buf_shift()

                let len = this.buf_size
                if (len < 32) {
                    len = 32
                }

                if (len < this.buf.length) {
                    let buf1 = pins.createBuffer(len)
                    buf1.write(0, this.buf.slice(0, len))
                    this.buf = buf1
                }
            }
        }

    } // namespace _msg

} // namespace qbuild
