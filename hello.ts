/**
 * A simple hello world program
 * 
 * Call hello() function in main.ts
 * 
 * From BH cmd line, execute `select 0` to select Mode 0
 * 
 * Press button A or B to decrease or increase data value of Mode 0
 * 
 * From BH cmd line, execute `write1` cmd to update data value of Mode 0: 
 * 
 *  - without CMD_EXT_MODE msg, update to 0x12 (18): 
 * 
 *      write1 c0 12
 * 
 *  - with CMD_EXT_MODE, update to 0x34 (52)
 * 
 *      write1 46 00 ; write1 c0 34
 * 
 * To create a Combi, execute BH cmd `combi`:
 * 
 *      combi 0 0 0 0 0 
 * 
 * Select it by `select 0`. And execute `combi 0` (without further params) to "delete" it.
 * 
 * Note that Q:build allows there are more combi's than modes, whereas BH does not support this 
 * well.
 * 
 */

/**
 * 
 */
function hello() {
    control.onEvent(EventBusSource.QBUILD_DEVICE_ID, EventBusValue.QBUILD_EVT_DISCONNECTED, function () {
        basic.showIcon(IconNames.Asleep)
    })

    control.onEvent(EventBusSource.QBUILD_DEVICE_ID, EventBusValue.QBUILD_EVT_CONNECTED, function () {
        basic.showNumber(qbuild.getModeData(0, 0))
    })

    control.onEvent(EventBusSource.QBUILD_DEVICE_ID, EventBusValue.QBUILD_EVT_M0_DATA_WRITTEN, function () {
        basic.showNumber(qbuild.getModeData(0, 0))
    })

    input.onButtonPressed(Button.A, function () {
        let a = qbuild.getModeData(0, 0)
        if (a <= 0) {
            return
        }
        a--
        qbuild.setModeData(0, 0, a)
        basic.showNumber(a)
    })

    input.onButtonPressed(Button.B, function () {
        let b = qbuild.getModeData(0, 0)
        if (b >= 0xff) {
            return
        }

        b++
        qbuild.setModeData(0, 0, b)
        basic.showNumber(b)
    })

    qbuild.setModeData(0, 0, 5)
    basic.showIcon(IconNames.Asleep)
    qbuild.go()
}
