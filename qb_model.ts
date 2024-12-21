
namespace qbuild {

    /**
     * Data types of mode data items
     */
    export enum ModeDataType {

        /**
         * 8-bit signed integer
         */
        //% 
        INT8 = 0,

        /**
         * 16-bit signed integer
         */
        //%
        INT16 = 1,

        /**
         * 32-bit signed integer
         */
        //%
        INT32 = 2,

        /**
         * 32-bit IEEE-754 float point number
         */
        //%
        FLOAT = 3,
    }

    export namespace _model {

        export const MAX_MODE_CNT = 16
        export const MAX_COMBI_CNT = 8
        export const MAX_MODE_NAME_LEN = 11

        export const ModeDataType_MIN = ModeDataType.INT8
        export const ModeDataType_MAX = ModeDataType.FLOAT

        export class ModeInfo {

            index: number;
            name: string;
            raw_range?: number[];
            pct_range?: number[];
            si_range?: number[];
            unit?: string;
            mapping?: number[];
            fmt: {
                item_cnt: number;
                item_type: ModeDataType;
                width: number;
                dp: number;
            }

            data: number[]
        }

        export interface CombiItem {
            mode: number
            data_item_index: number
        }

        export class CombiConfig {
            index: number
            items: CombiItem[]
        }

        export class DeviceInfo {

            id: number;
            modes: ModeInfo[];
            fw_ver: number;
            hw_ver: number;
            combi: number;

            selected_mode: number;
            combi_config: CombiConfig[];

            getCombi(index: number): CombiConfig {
                if (index < 0 || index >= this.combi_config.length) {
                    return null
                }
                return this.combi_config[index]
            }

            removeCombi(index: number): boolean {
                if (index < 0 || index >= this.combi_config.length) {
                    return false
                }
                if (this.combi_config[index]) {
                    this.combi_config[index] = null
                    return true
                }
                return false
            }

            setCombi(index: number, combi: CombiConfig): boolean {
                if (index < 0 || index >= MAX_COMBI_CNT) { return false }

                if (index < this.combi_config.length) {
                    this.combi_config[index] = combi
                } else {
                    for (let i = this.combi_config.length; i < index; i++) {
                        this.combi_config.push(null)
                    }
                    this.combi_config.push(combi)
                }

                return true
            }
        }

        export function createDefaultDevice(): DeviceInfo {

            let d = new DeviceInfo()

            d.id = 0xab

            let m = createDefaultMode()
            d.modes = [m]

            d.fw_ver = 0x10000000
            d.hw_ver = 0x10000000
            d.combi = 0

            d.combi_config = []

            return d
        }

        export function createDefaultMode(index: number = 0): ModeInfo {

            let m = new ModeInfo()

            m.index = index
            m.name = "M" + index
            m.unit = ""
            m.fmt = {
                item_cnt: 1,
                item_type: ModeDataType.INT8,
                width: 3,
                dp: 0,
            }

            m.data = [0]

            return m
        }

        export function sizeOfModeDataType(data_type: ModeDataType): number {
            switch (data_type) {
                case ModeDataType.INT8: return 1
                case ModeDataType.INT16: return 2
                case ModeDataType.INT32:
                case ModeDataType.FLOAT:
                    return 4
            }
            return 0
        }

        export const device: DeviceInfo = createDefaultDevice()

    } // namespace _model

    const device = _model.device

    /**
     *  Make a version number. A version is composed of 4 numbers in format of "major.minor.rev.build"
     */
    //% blockId=qbuild_make_version block="Q:build|make version $major $minor $rev $build"
    //% inlineInputMode=inline
    //% advanced=true
    //% major.min=0 major.max=9 major.defl=1
    //% minor.min=0 minor.max=9 minor.defl=0
    //% rev.min=0 rev.max=99 rev.defl=0
    //% build.min=0 build.max=9999 build.defl=0
    export function makeVersion(major: number = 1, minor: number = 0, rev: number = 0, build: number = 0): number {

        major = Math.floor(major)
        minor = Math.floor(minor)
        rev = Math.floor(rev)
        build = Math.floor(build)

        if (major < 0) {
            major = 0
        } else if (major > 9) {
            major = 9
        }

        if (minor < 0) {
            minor = 0
        } else if (minor > 9) {
            minor = 9
        }

        if (rev < 0) {
            rev = 0
        } else if (rev > 99) {
            rev = 99
        }

        if (build < 0) {
            build = 0
        } else if (build > 9999) {
            build = 9999
        }

        let b0 = makeBCD(build % 100)
        let b1 = makeBCD(Math.floor(build / 100))
        let b2 = makeBCD(rev)
        let b3 = makeBCD(major * 10 + minor)
        return (b3 << 24) | (b2 << 16) | (b1 << 8) | b0
    }

    function makeBCD(n: number): number {

        let n1 = 0
        for (let p = 0; n; p += 4) {
            let n2 = n % 10
            n = Math.floor(n / 10)
            n1 |= (n2 << p)
        }

        return n1
    }

    /**
     *  Set device id (0 - 0xff)
     */
    //% blockId=qbuild_set_device_id
    //% block="Q:build|set device id $id"
    //% group="Device"
    //% id.min=0 id.max=0xff
    export function setDeviceId(id: number) {
        id = Math.floor(id)
        device.id = id < 0 ? 0 : id > 0xff ? 0xff : id
    }

    /**
     *  Set hardware version
     */
    //% blockId=qbuild_set_hw_ver
    //% block="Q:build|set hardware version $ver"
    //% group="Device"
    //% advanced=true
    export function setHardwareVer(ver: number) {
        device.hw_ver = Math.floor(ver)
    }

    /**
     *  Set firmware version 
     */
    //% blockId=qbuild_set_fw_ver
    //% block="Q:build|set firmware version $ver"
    //% group="Device"
    //% advanced=true
    export function setFirmwareVer(ver: number) {
        device.fw_ver = Math.floor(ver)
    }

    /**
     *  Set default mode
     */
    //% blockId="qbuild_set_default_mode" block="Q:build|set default mode $mode"
    //% mode.min=0 mode.max=15 mode.defl=0
    export function setDefaultMode(mode: number) {
        mode = Math.floor(mode)
        if (mode < 0 || mode >= _model.MAX_MODE_CNT) {
            return
        }

        device.selected_mode = mode
    }

    /**
     *  Set number of modes
     */
    //% blockId=qbuild_set_mode_count
    //% block="Q:build|set mode count $count"
    //% group="Device"
    //% count.min=1 count.max=16 count.defl=1
    export function setModeCount(count: number) {

        count = Math.floor(count)

        if (count < 1 || count > _model.MAX_MODE_CNT) {
            return
        }

        if (count == device.modes.length) {
            return
        }

        if (count < device.modes.length) {
            // Truncate
            // Not sure whether slice() creates a new array..
            device.modes = device.modes.slice(0, count).concat([])
        } else {
            // Append more
            for (let i = device.modes.length; i < count; i++) {
                device.modes.push(_model.createDefaultMode(i))
            }
        }
    }

    /**
     *  Set combi of device. The combi is a 16-bit bitmap (0 - 0xffff)
     */
    //% blockId=qbuild_set_combi block="Q:build|set combi $combi"
    //% group="Device" advanced=true
    //% combi.min=0 combi.max=0xffff combi.defl=0
    export function setCombi(combi: number) {
        combi = Math.floor(combi)
        if (combi < 0 || combi > 0xffff) {
            return
        }

        device.combi = combi
    }

    /**
     *  Set name of specified mode
     */
    //% blockId=qbuild_set_mode_name
    //% block="Q:build|set name of mode $index as $name"
    //% group="Mode"
    //% index.min=0 index.max=15
    export function setModeName(index: number, name: string) {

        index = Math.floor(index)

        if (index < 0 || index >= device.modes.length) {
            return
        }

        let m = device.modes[index]

        if (name && name.length > 11) {
            m.name = name.substr(0, 11)
        } else {
            m.name = name ? name : ""
        }
    }

    /**
     *  Set data format of specified mode
     * 
     * @param index index of mode
     * @param item_count number of data items
     * @param item_type data type of data items
     * @param width number of characters for displaying a data item
     * @param dp number of digits after decimal point
     * 
     */
    //% blockId=qbuild_set_mode_fmt
    //% block="Q:build|set data format of mode $index data type: $item_type number of items: $item_count||display width: $width digits after deciaml point: $dp"
    //% group="Mode"
    //% index.min=0 index.max=15
    //% item_count.min=1 item_count.max=16
    //% width.min=0 width.max=40 width.defl=8
    //% dp.min=0 dp.max=40 dp.defl=0
    export function setModeFmt(index: number, item_count: number, item_type: ModeDataType, width: number = 8, dp: number = 0) {

        index = Math.floor(index)
        if (index < 0 || index >= device.modes.length) {
            return
        }

        let m = device.modes[index]

        item_count = Math.floor(item_count)
        if (item_count < 1) {
            item_count = 1
        } else if (item_count > 8) {
            item_count = 8
        }

        if ((0 + item_type) < _model.ModeDataType_MIN
            || (0 + item_type) > _model.ModeDataType_MAX) {
            item_type = ModeDataType.INT8
        }

        const MAX_WIDTH = 40

        width = Math.floor(width)
        if (width < 0) {
            width = 0
        } else if (width > MAX_WIDTH) {
            width = MAX_WIDTH
        }

        dp = Math.floor(dp)
        if (dp < 0) {
            dp = 0
        } else if (dp > MAX_WIDTH) {
            dp = MAX_WIDTH
        }

        m.fmt.item_cnt = item_count
        m.fmt.item_type = item_type
        m.fmt.width = width
        m.fmt.dp = dp

        // TODO: create array of length?
        let data = []
        for (let i = 0; i < item_count; i++) {
            data.push(0)
        }
        m.data = data
    }

    /**
     *  Set value of a data item.
     * 
     * @param mode_index index of mode
     * @param data_item_index index of data item
     * @param value value of data item
     */
    //% blockId=qbuild_set_mode_data
    //% block="Q:build|set value of data item $data_item_index of mode $mode_index to $value"
    //% group="Mode"
    //% mode_index.min=0 mode_index.max=15
    //% data_item_index.min=0 data_item_index.max=15
    export function setModeData(mode_index: number, data_item_index: number, value: number) {
        mode_index = Math.floor(mode_index)
        if (mode_index < 0 || mode_index >= device.modes.length) {
            return
        }

        let mode = device.modes[mode_index]

        data_item_index = Math.floor(data_item_index)
        if (data_item_index < 0 || data_item_index >= mode.fmt.item_cnt) {
            return
        }

        mode.data[data_item_index] = value
    }

    /**
     *  Get the value of a data item
     *
     * @param mode_index index of mode
     * @param data_item_index index of data item
     */
    //% block="Q:build|value of data item $data_item_index of mode $mode_index"
    //% group="Mode"
    //% mode_index.min=0 mode_index.max=15
    export function getModeData(mode_index: number, data_item_index: number): number {
        mode_index = Math.floor(mode_index)
        if (mode_index < 0 || mode_index >= device.modes.length) {
            return 0
        }

        let mode = device.modes[mode_index]

        data_item_index = Math.floor(data_item_index)
        if (data_item_index < 0 || data_item_index >= mode.fmt.item_cnt) {
            return 0
        }

        return mode.data[data_item_index]
    }

    /**
     *  Set unit of mode data. Common units include "CM", "INCH" and "PCT" etc.
     */
    //% blockId=qbuild_set_mode_unit
    //% block="Q:build|set unit of mode $index as $unit"
    //% advanced=true 
    //% group="Mode"
    //% index.min=0 index.max=15
    export function setModeUnit(index: number, unit: string) {
        index = Math.floor(index)
        if (index < 0 || index >= device.modes.length) {
            return
        }

        let m = device.modes[index]

        const MAX_LEN = 10

        if (!unit) {
            unit = ""
        } else if (unit.length > MAX_LEN) {
            unit = unit.substr(0, MAX_LEN)
        }

        m.unit = unit
    }

    /**
     *  Set the "RAW" range of specified mode
     */
    //% blockId=qbuild_set_raw_range
    //% block="Q:build|set RAW range of mode $index as [$min - $max]"
    //% advanced=true 
    //% group="Mode"
    //% index.min=0 index.max=15
    export function setRawRange(index: number, min: number, max: number) {
        index = Math.floor(index)
        if (index < 0 || index >= device.modes.length) {
            return
        }

        let m = device.modes[index]
        m.raw_range = [min, max]
    }

    /**
     *  Set the "SI" range of specified mode
     */
    //% blockId=qbuild_set_si_range
    //% block="Q:build|set SI range of mode $index as [$min - $max]"
    //% advanced=true 
    //% group="Mode"
    //% index.min=0 index.max=15
    export function setSiRange(index: number, min: number, max: number) {
        index = Math.floor(index)
        if (index < 0 || index >= device.modes.length) {
            return
        }

        let m = device.modes[index]
        m.si_range = [min, max]
    }

    /**
     *  Set the "PCT" range of specified mode
     */
    //% blockId=qbuild_set_pct_range
    //% block="Q:build|set PCT range of mode $index as [$min - $max]"
    //% advanced=true 
    //% group="Mode"
    //% index.min=0 index.max=15
    export function setPctRange(index: number, min: number, max: number) {
        index = Math.floor(index)
        if (index < 0 || index >= device.modes.length) {
            return
        }

        let m = device.modes[index]
        m.pct_range = [min, max]
    }

    /**
     *  Set the "mapping" of specified mode
     */
    //% blockId=qbuild_set_mapping
    //% block="Q:build|set mapping of mode $index as $from to $to"
    //% advanced=true 
    //% group="Mode"
    //% index.min=0 index.max=15
    //% from.min=0 from.max=0xff
    //% to.min=0 to.max=0xff
    export function setMapping(index: number, from: number, to: number) {
        index = Math.floor(index)
        if (index < 0 || index >= device.modes.length) {
            return
        }

        let m = device.modes[index]

        from = Math.floor(from)
        if (from < 0 || from > 0xff) {
            return
        }

        to = Math.floor(to)
        if (to < 0 || to > 0xff) {
            return
        }

        m.mapping = [from, to]
    }

}
