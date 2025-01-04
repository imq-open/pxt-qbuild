
//%
namespace qbuild {

    /**
     * Default configuration of gyro. Fine tune using the `icm42670p` extension if necessary.
     */
    //% blockId=qbuild_config_gyro
    //% block="Q:build config gyro"
    export function configGyro() {
        icm42670p.setSlaveAddress(icm42670p.SlaveAddress.AD0_0)
        icm42670p.setInt1Pin(DigitalPin.P16)
    }

} // namespace qbuild 
