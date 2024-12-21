control.onEvent(EventBusSource.QBUILD_DEVICE_ID, EventBusValue.QBUILD_EVT_DISCONNECTED, function () {
    basic.showIcon(IconNames.Asleep)
})
control.onEvent(EventBusSource.QBUILD_DEVICE_ID, EventBusValue.QBUILD_EVT_CONNECTED, function () {
    basic.showNumber(qbuild.getModeData(0, 0))
})
input.onButtonPressed(Button.A, function () {
    a = qbuild.getModeData(0, 0)
    if (a <= 0) {
        return
    }
    a += -1
    qbuild.setModeData(0, 0, a)
    basic.showNumber(a)
})
input.onButtonPressed(Button.B, function () {
    b = qbuild.getModeData(0, 0)
    b += 1
    qbuild.setModeData(0, 0, b)
    basic.showNumber(b)
})
let b = 0
let a = 0
qbuild.setModeData(0, 0, 5)
basic.showIcon(IconNames.Asleep)
qbuild.go()
basic.forever(function () {
	
})
