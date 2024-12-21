

namespace qbuild {

    export namespace _misc {

        const DEBUG = true

        const CODE_0 = 0x30
        const CODE_A = 0x41
        const CODE_a = 0x61

        export function debug(msg: string) {
            if (DEBUG) {
                serial.writeString(msg + "\n")
            }
        }

        export function bufToStr(buf: Buffer): string {
            let str = ""
            for (let i = 0; i < buf.length; i++) {
                str = str + " " + uint8ToHexStr(buf.getUint8(i))
            }
            return str
        }

        export function uint8ToHexStr(n: number): string {
            return digitHex(0xf & (n >> 4)) + digitHex(0xf & n)
        }

        export function digitHex(n: number): string {
            return n <= 9 ? String.fromCharCode(CODE_0 + n)
                : String.fromCharCode(CODE_a + n - 10)
        }

    } // namespace _misc

} // namespace qbuild
