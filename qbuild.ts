
/// <reference path="qb_model.ts" />
/// <reference path="qb_msg.ts" />
/// <reference path="qb_misc.ts" />

declare const enum EventBusSource {
    //% blockIdentity="control.eventSourceId"
    QBUILD_DEVICE_ID = 71,
}

declare const enum EventBusValue {
    /**
     * Connected to hub
     */
    //% blockIdentity="control.eventValueId"
    QBUILD_EVT_CONNECTED = 1,
    /**
     * Disconnected from hub
     */
    //% blockIdentity="control.eventValueId"
    QBUILD_EVT_DISCONNECTED = 2,
    /**
     * Mode 0 written by remote (hub)
     */
    //% blockIdentity="control.eventValueId"
    QBUILD_EVT_M0_DATA_WRITTEN = 10,
}


/**
 * Q:build API
 */
//% weight=100 color=#0fbc11 icon=""
//% block="Q:build"
//% groups=["Device", "Mode", "others"]
namespace qbuild {

    interface DeviceState {
        onRxBreak(): void;
        onMsgReceived(seq: number, msg: Msg): void;
        run(): DeviceState;
    }

    class DefaultState implements DeviceState {

        protected break_flag: boolean

        constructor() {
            this.break_flag = false
        }

        onRxBreak() { this.break_flag = true }
        onMsgReceived(seq: number, msg: Msg) { }
        run(): DeviceState { return null }

        protected pause_breakable(ms: number): boolean {
            const t0 = input.runningTime()
            while (true) {
                basic.pause(1)
                // TODO: time wrap-around?
                let t = input.runningTime() - t0
                if (t >= ms) { return true }
                if (this.break_flag) { return false }
            }
        }
    }

    import Msg = _msg.Msg
    import MsgType = _msg.MsgType
    import SysMsgType = _msg.SysMsgType
    import CmdType = _msg.CmdType
    import InfoType = _msg.InfoType
    import DecodeResult = _msg.DecodeResult

    import debug = _misc.debug

    enum Consts {
        RX_SEQ_MAX = 99999,
        MAX_EXT_MODE_INTERVAL = 200,
    }

    const tx_pin = pins.P13
    const rx_pin = pins.P14

    const device = _model.device
    const msg_decoder = new _msg.MsgDecoder()
    let device_state: DeviceState

    class IdState extends DefaultState {

        constructor() { super() }

        run(): DeviceState {

            rx_pin.setPull(PinPullMode.PullNone)
            while (!rx_pin.digitalRead()) { basic.pause(1) }
            rx_pin.setPull(PinPullMode.PullUp)

            while (!serial2.setEnabled(false)) { basic.pause(1) }
            tx_pin.digitalWrite(false)

            basic.pause(200)

            tx_pin.digitalWrite(true)
            serial2.setEnabled(true)

            return new InfoState()
        }
    }

    class InfoState extends DefaultState {

        private baud: number
        private ack_recv: boolean

        constructor() {
            super()
        }

        onMsgReceived(seq: number, msg: Msg) {
            let msg_type = msg.getMsgType()
            let sub_type = msg.getSubType()

            // debug("info: msg " + msg_type + "/" + sub_type)

            if (MsgType.CMD == msg_type && CmdType.SPEED == sub_type) {
                let baud = msg.getData(0, NumberFormat.UInt32LE)

                // debug("SPEED: " + baud)

                if (baud < 2400) {
                    baud = 2400
                } else if (baud > 115200) {
                    baud = 115200
                }

                this.baud = baud
            } else if (MsgType.SYS == msg_type && SysMsgType.ACK == sub_type) {
                // debug("info: ACK recv")
                this.ack_recv = true
            }
        }

        run(): DeviceState {

            if (this.break_flag) { return new IdState() }
            serial2.setBaudRate(BaudRate.BaudRate2400)

            this.pause_breakable(1)

            while (true) {
                if (this.break_flag) { return new IdState() }
                if (this.run1()) { return new ModeState() }

                if (this.break_flag) { return new IdState() }
                this.pause_breakable(500)
            } // while 
        }

        private run1(): boolean {

            const INTERVAL = 10

            do {
                if (this.break_flag) { return false }

                let msg = _msg.createCmdMsg(CmdType.TYPE, 1)
                msg.setDataUint8(0, device.id)
                msg.calcCrc()
                serial2.writeBuffer(msg.buf)
            } while (false)

            this.pause_breakable(INTERVAL)

            do {
                if (this.break_flag) { return false }

                const n = device.modes.length - 1
                let a: number[]
                if (n < 8) {
                    a = [n, 0]
                } else {
                    a = [n, 0, n, 0]
                }

                let msg = _msg.createCmdMsg(CmdType.MODES, a.length)
                msg.setDataArray(0, NumberFormat.UInt8LE, a)
                msg.calcCrc()
                serial2.writeBuffer(msg.buf)
            } while (false)

            this.pause_breakable(INTERVAL)

            do {
                if (this.break_flag) { return false }

                let msg = _msg.createCmdMsg(CmdType.SPEED, 4)
                msg.setData(0, NumberFormat.UInt32LE, 115200)
                msg.calcCrc()
                serial2.writeBuffer(msg.buf)
            } while (false)

            this.pause_breakable(INTERVAL)

            do {
                if (this.break_flag) { return false }

                let a = [device.fw_ver, device.hw_ver]
                let msg = _msg.createCmdMsg(CmdType.VERSION, 8)
                msg.setDataArray(0, NumberFormat.UInt32LE, a)
                msg.calcCrc()

                serial2.writeBuffer(msg.buf)
            } while (false)

            for (let i = device.modes.length - 1; i >= 0; i--) {

                const m = device.modes[i]

                this.pause_breakable(INTERVAL)

                do {
                    if (this.break_flag) { return false }

                    let name = m.name ? m.name : ""
                    let msg = _msg.createInfoMsg(InfoType.NAME, m.index, name.length)
                    msg.setDataStr(0, name)
                    msg.calcCrc()

                    // debug("name = " + name)
                    // debug("msg = " + _misc.bufToStr(msg.buf))

                    serial2.writeBuffer(msg.buf)
                } while (false)

                if (m.raw_range) {
                    this.pause_breakable(INTERVAL)
                    if (this.break_flag) { return false }

                    let msg = _msg.createInfoMsg(InfoType.RAW, m.index, 8)
                    msg.setDataArray(0, NumberFormat.Float32LE, m.raw_range)
                    msg.calcCrc()

                    serial2.writeBuffer(msg.buf)
                }

                if (m.pct_range) {
                    this.pause_breakable(INTERVAL)
                    if (this.break_flag) { return false }

                    let msg = _msg.createInfoMsg(InfoType.PCT, m.index, 8)
                    msg.setDataArray(0, NumberFormat.Float32LE, m.pct_range)
                    msg.calcCrc()

                    serial2.writeBuffer(msg.buf)
                }

                if (m.si_range) {
                    this.pause_breakable(INTERVAL)
                    if (this.break_flag) { return false }

                    let msg = _msg.createInfoMsg(InfoType.SI, m.index, 8)
                    msg.setDataArray(0, NumberFormat.Float32LE, m.si_range)
                    msg.calcCrc()

                    serial2.writeBuffer(msg.buf)
                }

                if (m.unit) {
                    this.pause_breakable(INTERVAL)
                    if (this.break_flag) { return false }

                    let unit = m.unit
                    let msg = _msg.createInfoMsg(InfoType.UNIT, m.index, unit.length)
                    msg.setDataStr(0, unit)
                    msg.calcCrc()
                    serial2.writeBuffer(msg.buf)
                }

                if (m.mapping) {
                    this.pause_breakable(INTERVAL)
                    if (this.break_flag) { return false }

                    let msg = _msg.createInfoMsg(InfoType.MAPPING, m.index, 2)
                    msg.setDataArray(0, NumberFormat.UInt8LE, m.mapping)
                    msg.calcCrc()
                    serial2.writeBuffer(msg.buf)
                }

                if (0 == m.index && device.combi) {
                    this.pause_breakable(INTERVAL)
                    if (this.break_flag) { return false }

                    let msg = _msg.createInfoMsg(InfoType.COMBI, m.index, 2)
                    msg.setData(0, NumberFormat.UInt16LE, device.combi)
                    msg.calcCrc()

                    serial2.writeBuffer(msg.buf)
                }

                this.pause_breakable(INTERVAL)

                do {
                    if (this.break_flag) { return false }

                    let fmt = m.fmt
                    let a = [fmt.item_cnt, fmt.item_type, fmt.width, fmt.dp]
                    let msg = _msg.createInfoMsg(InfoType.FORMAT, m.index, 4)
                    msg.setDataArray(0, NumberFormat.UInt8LE, a)
                    msg.calcCrc()

                    serial2.writeBuffer(msg.buf)
                } while (false)

            } // for

            this.pause_breakable(INTERVAL)

            do {
                if (this.break_flag) { return false }

                // debug("info: send ACK")

                serial2.readString()
                msg_decoder.reset()
                this.baud = 0
                this.ack_recv = false

                sendAck()
            } while (false)

            const t0 = input.runningTime()

            while (true) {
                if (this.break_flag) { return false }
                if (this.ack_recv) {
                    break
                }

                let t = input.runningTime() - t0
                if (t > 200) {
                    return false
                }

                basic.pause(1)
            } // while

            if (this.baud > 0) {
                // debug("change baud " + this.baud)
                serial2.setBaudRate(this.baud)
            }

            return true
        }

    }

    class ModeState extends DefaultState {

        private t_nack: number

        private ext_info?: {
            t: number
            seq: number
            mode: number
        }

        constructor() {
            super()
        }

        onMsgReceived(seq: number, msg: Msg) {

            let msg_type = msg.getMsgType()
            let sub_type = msg.getSubType()

            if (MsgType.CMD == msg_type && CmdType.EXT_MODE == sub_type) {
                let mode = msg.getDataUint8(0)

                if (0 != mode && 8 != mode) {
                    this.ext_info = null
                } else {
                    this.ext_info = {
                        t: input.runningTime(),
                        seq: seq,
                        mode: mode,
                    }
                }

                return
            } // EXT_MODE

            try {
                if (MsgType.SYS == msg_type && SysMsgType.NACK == sub_type) {
                    this.t_nack = input.runningTime()
                } else if (MsgType.CMD == msg_type && CmdType.SELECT == sub_type) {
                    this.processMsg_SELECT(seq, msg)
                } else if (MsgType.CMD == msg_type && CmdType.WRITE == sub_type) {
                    this.processMsg_WRITE(seq, msg)
                } else if (MsgType.DATA == msg_type) {
                    this.processMsg_DATA(seq, msg)
                }
            } finally {
                this.ext_info = null
            }
        }

        private processMsg_SELECT(seq: number, msg: Msg) {

            let mode = msg.getDataUint8(0)
            do {
                if (!this.ext_info) { break }

                let seq1 = this.ext_info.seq + 1
                if (seq1 > Consts.RX_SEQ_MAX) {
                    seq1 = 0
                }

                if (seq != seq1) { break }

                let t = input.runningTime() - this.ext_info.t
                if (t > Consts.MAX_EXT_MODE_INTERVAL) { break }

                mode += this.ext_info.mode
            } while (false)

            if (0 <= mode && mode < device.modes.length) {
                device.selected_mode = mode
            }
            // setDefaultMode(mode)
        }

        private processMsg_WRITE(seq: number, msg: Msg) {
            if (this.processMsg_WRITE_combi(seq, msg) //
                // || this.processMsg_WRITE_xxx(seq, msg) //
                // more WRITE msgs ..
            ) { }
        }

        private processMsg_WRITE_combi(seq: number, msg: Msg): boolean {

            const data_len = msg.getDataLen()
            if (data_len < 2) { return false }

            let mode_cnt: number
            do {
                let n1 = msg.getDataUint8(0)
                if (!(0x20 & n1)) { return false }
                mode_cnt = n1 & ~0x20
            } while (false)

            // Return true since here ----

            const combi_index = msg.getDataUint8(1)

            // TODO:
            // We're allowing more Combi's (possibly with holes) than modes

            // if (combi_index >= device.modes.length) { return true }
            if (combi_index >= _model.Consts.MAX_COMBI_CNT) { return true }

            if (2 == data_len) {
                device.removeCombi(combi_index)
                return true
            }

            // debug("combi: " + mode_cnt + ", " + combi_index)

            let items: _model.CombiItem[] = []

            for (let i = 0; i < mode_cnt; i++) {
                let n1 = msg.getDataUint8(2 + i)
                let mode_index = n1 >> 4
                let off = 0xf & n1
                if (mode_index >= device.modes.length) { return true }
                let mode = device.modes[mode_index]
                if (off >= mode.fmt.item_cnt) { return true }

                // debug("  #" + i + ": " + mode_index + ", " + off)

                items.push({
                    mode: mode_index,
                    data_item_index: off,
                })
            } // for

            // Apply data size limit
            do {
                // To maximize usablility we'll allow the maximum data size a msg can carry
                const MAX_SIZE = // _model.MAX_MODE_DATA_SIZE 
                    _msg.Consts.MAX_DATA_LEN

                let data_size = 0
                for (let i of items) {
                    let mode = device.modes[i.mode]
                    data_size += _model.sizeOfModeDataType(mode.fmt.item_type)
                }

                if (data_size > MAX_SIZE) {
                    return true
                }
            } while (false)

            device.setCombi(combi_index, items)

            return true
        }

        private processMsg_DATA(seq: number, msg: Msg) {

            let mode = msg.getMode()
            do {
                if (!this.ext_info) { break }

                let seq1 = this.ext_info.seq + 1
                if (seq1 > Consts.RX_SEQ_MAX) {
                    seq1 = 0
                }

                if (seq != seq1) { break }

                let t = input.runningTime() - this.ext_info.t
                if (t > Consts.MAX_EXT_MODE_INTERVAL) { break }

                mode += this.ext_info.mode
            } while (false)

            if (mode < 0 || mode >= device.modes.length) {
                return
            }

            let m = device.modes[mode]
            let item_size = _model.sizeOfModeDataType(m.fmt.item_type)
            let item_cnt = m.fmt.item_cnt

            let data_size = msg.getDataLen()
            if (data_size < item_cnt * item_size) { return }

            for (let i = 0; i < item_cnt; i++) {

                let v: number = 0

                switch (m.fmt.item_type) {
                    case ModeDataType.INT8:
                        v = msg.getData(i * item_size, NumberFormat.Int8LE)
                        break
                    case ModeDataType.INT16:
                        v = msg.getData(i * item_size, NumberFormat.Int16LE)
                        break
                    case ModeDataType.INT32:
                        v = msg.getData(i * item_size, NumberFormat.Int32LE)
                        break
                    case ModeDataType.FLOAT:
                        v = msg.getData(i * item_size, NumberFormat.Float32LE)
                        break
                }// switch

                m.data[i] = v
            } // for

            control.raiseEvent(EventBusSource.QBUILD_DEVICE_ID, mode + EventBusValue.QBUILD_EVT_M0_DATA_WRITTEN)
        }

        run(): DeviceState {
            control.raiseEvent(EventBusSource.QBUILD_DEVICE_ID, EventBusValue.QBUILD_EVT_CONNECTED)

            let next: DeviceState
            try {
                next = this.run1()
            } finally {
                control.raiseEvent(EventBusSource.QBUILD_DEVICE_ID, EventBusValue.QBUILD_EVT_DISCONNECTED)
            }

            return next
        }

        private run1(): DeviceState {

            // debug("mode")

            this.t_nack = input.runningTime()

            while (true) {
                if (this.break_flag) { return new IdState() }

                let t = input.runningTime() - this.t_nack
                if (t > 200) {
                    return new InfoState()
                }

                this.sendData()

                if (this.break_flag) { return new IdState() }
                this.pause_breakable(10)
            } // while 

        }

        private sendData() {

            let mode_index = device.selected_mode

            // if (mode_index >= device.modes.length) {
            //     mode_index = 0
            // }

            // debug("sendData: " + mode_index)

            let msg: Msg = null
            do {

                let combi = device.getCombi(mode_index)
                if (combi && combi.items.length > 0) {
                    msg = this.createDataMsg_combi(combi)
                    break
                }

                if (mode_index < device.modes.length) {
                    msg = this.createDataMsg_mode(device.modes[mode_index])
                    break
                }

                // Fall back to #0 ---

                mode_index = 0

                combi = device.getCombi(0)
                if (combi && combi.items.length > 0) {
                    msg = this.createDataMsg_combi(combi)
                    break
                }

                msg = this.createDataMsg_mode(device.modes[0])

            } while (false)

            do {
                let msg = _msg.createCmdMsg(CmdType.EXT_MODE, 1)
                msg.setDataUint8(0, mode_index >= 8 ? 8 : 0)
                msg.calcCrc()
                serial2.writeBuffer(msg.buf)
            } while (false)

            // msg.calcCrc()
            serial2.writeBuffer(msg.buf)
        }

        private createDataMsg_combi(combi: _model.CombiConfig): Msg {

            const items = combi.items

            let size = 0
            for (let item of items) {
                let mode = device.modes[item.mode]
                size += _model.sizeOfModeDataType(mode.fmt.item_type)
            }

            let msg = _msg.createDataMsg(combi.index, size)

            let off = 0
            for (let i = 0; i < items.length; i++) {
                let item = items[i]
                let mode = device.modes[item.mode]
                let data = mode.data[item.data_item_index]
                switch (mode.fmt.item_type) {
                    case ModeDataType.INT8:
                        msg.setData(off, NumberFormat.Int8LE, data)
                        off += 1
                        break
                    case ModeDataType.INT16:
                        msg.setData(off, NumberFormat.Int16LE, data)
                        off += 2
                        break
                    case ModeDataType.INT32:
                        msg.setData(off, NumberFormat.Int32LE, data)
                        off += 4
                        break
                    case ModeDataType.FLOAT:
                        msg.setData(off, NumberFormat.Float32LE, data)
                        off += 4
                        break
                } // switch

            } // for

            msg.calcCrc()
            return msg
        }

        private createDataMsg_mode(mode: _model.ModeInfo): Msg {

            const index = mode.index

            const cnt = mode.fmt.item_cnt
            // const size = _model.sizeOfModeDataType(mode.fmt.item_type)

            let msg: Msg
            switch (mode.fmt.item_type) {
                case ModeDataType.INT8:
                    msg = _msg.createDataMsg(index, cnt * 1)
                    msg.setDataArray(0, NumberFormat.Int8LE, mode.data)
                    break
                case ModeDataType.INT16:
                    msg = _msg.createDataMsg(index, cnt * 2)
                    msg.setDataArray(0, NumberFormat.Int16LE, mode.data)
                    break
                case ModeDataType.INT32:
                    msg = _msg.createDataMsg(index, cnt * 4)
                    msg.setDataArray(0, NumberFormat.Int32LE, mode.data)
                    break
                case ModeDataType.FLOAT:
                    msg = _msg.createDataMsg(index, cnt * 4)
                    msg.setDataArray(0, NumberFormat.Float32LE, mode.data)
                    break
            } // switch 

            msg.calcCrc()
            return msg
        }

    }

    function sendAck() {
        let buf = pins.createBuffer(1)
        buf.setUint8(0, SysMsgType.ACK)
        serial2.writeBuffer(buf)
    }

    // ================================================

    /**
     * 
     */
    let go_guard = false
    let rx_seq = function (): () => number {
        let next = 0
        return function (): number {
            let seq = next++
            if (next > Consts.RX_SEQ_MAX) {
                next = 0
            }
            return seq
        }
    }()

    /**
     * Whether the device is currently connected to hub
     */
    //% blockId=qbuild_is_connected block="Q:build|is connected"
    //% group="Device"
    export function isConnected(): boolean {
        let state = device_state
        return state && (state instanceof ModeState)
    }

    /**
     *  Start the engine and go!
     */
    //% blockId=qbuild_go block="Q:build|go!"
    //% advanced=false
    export function go() {

        do {
            if (go_guard) {
                return
            }
            go_guard = true
        } while (false)

        const SERIAL_BUF_SIZE = 132
        serial2.setRxBufferSize(SERIAL_BUF_SIZE)
        serial2.setTxBufferSize(SERIAL_BUF_SIZE)

        control.onEvent(EventBusSource.SERIAL2_DEVICE_ID, EventBusValue.SERIAL2_EVT_ERROR_BREAK,
            onRxBreak
        )

        control.onEvent(EventBusSource.SERIAL2_DEVICE_ID, EventBusValue.SERIAL2_EVT_DATA_RECEIVED,
            onRxReady
        )

        serial2.readString()
        control.inBackground(go1)
    }

    function go1() {
        device_state = new InfoState()
        while (true) {
            device_state = device_state.run()
            if (!device_state) {
                // break 
                device_state = new InfoState()
            }
        } // while 
    }

    function onRxBreak() {

        // debug("break")

        let state = device_state
        if (state) {
            state.onRxBreak()
        }
    }

    function onRxReady() {

        let buf = serial2.readBuffer(0)
        if (!buf || 0 == buf.length) { return }

        // debug("rx: " + buf.length)
        // debug(_misc.bufToStr(buf))

        msg_decoder.feed(buf)

        while (true) {
            let res = msg_decoder.decode()

            // debug("decode: " + res)

            if (DecodeResult.NEED_DATA == res) {
                break
            }

            if (DecodeResult.MSG_DECODED == res) {
                let msg = msg_decoder.getMsg()
                let state = device_state
                let seq = rx_seq()
                if (state && msg) {
                    state.onMsgReceived(seq, msg)
                }

            } else if (DecodeResult.MSG_ERROR == res) {
                msg_decoder.reset()
                serial2.readString()
                rx_seq()
            }

            basic.pause(1)

        } // while 

    }

}
