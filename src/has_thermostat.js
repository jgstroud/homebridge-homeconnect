// Homebridge plugin for Home Connect home appliances
// Copyright © 2021-2023 Alexander Thoukydides

let Service, Characteristic;

// Add mode switches to an accessory
module.exports = {
    name: 'HasThermostat',

    // Initialize the mixin
    async init(thermostats) {
        // Shortcuts to useful HAP objects
        Service = this.homebridge.hap.Service;
        Characteristic = this.homebridge.hap.Characteristic;

        // Check which settings are supported to add appropriate services
        let allSettings = await this.getCached('settings',
                                               () => this.device.getSettings());

        // Add services for each mode setting
        for (let key of allSettings.map(s => s.key)) {
            let thermName = thermostats[key];
            if (thermName) {
                // Add a switch service for this mode
                this.log('Supports ' + thermName);
                this.log(key);
                let thermSettings = await this.getCached(key,
                                                         () => this.device.getSetting(key));
                this.addThermostat(thermName, key, thermSettings);
            }
        }
    },

    // Add a switch for a mode setting
    addThermostat(name, key, thermSettings) {
        // Add a Thermostat service
        let subtype = 'thermostat ' + name;
        let service =
            this.accessory.getServiceByUUIDAndSubType(Service.Thermostat, subtype)
            || this.accessory.addService(Service.Thermostat, name, subtype);

        service.addOptionalCharacteristic(Characteristic.ConfiguredName);
        service.setCharacteristic(Characteristic.ConfiguredName, name);

        if (thermSettings.unit === '°C') {
            this.log('Setting units to C');
            this.tempUnit = Characteristic.TemperatureDisplayUnits.CELSIUS;
        } else {
            this.log('Setting units to F');
            this.tempUnit = Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
        }
        this.device.on(key, item => {
            this.log('Current Temp ' + item.value);
            service.updateCharacteristic(Characteristic.CurrentTemperature, item.value);
            service.updateCharacteristic(Characteristic.TargetTemperature, item.value);
        });

        // cool only
        service.setCharacteristic(Characteristic.CurrentHeatingCoolingState, Characteristic.CurrentHeatingCoolingState.COOL);
        service.getCharacteristic(Characteristic.TargetHeatingCoolingState).setProps({
            minValue: Characteristic.TargetHeatingCoolingState.COOL,
            maxValue: Characteristic.TargetHeatingCoolingState.COOL
        }).updateValue(Characteristic.TargetHeatingCoolingState.COOL);
        service.setCharacteristic(Characteristic.TargetHeatingCoolingState, Characteristic.TargetHeatingCoolingState.COOL);

        service.getCharacteristic(Characteristic.TemperatureDisplayUnits, Characteristic.TemperatureDisplayUnits.CELSIUS);

        service.getCharacteristic(Characteristic.TargetTemperature).setProps({
            minValue: thermSettings.constraints.min,
            maxValue: thermSettings.constraints.max
        }).on('set', this.callbackify(async value => {
            this.log('SET ' + name + ' ' + (value));
            await this.device.setSetting(key, value);
        }));

        service.getCharacteristic(Characteristic.TemperatureDisplayUnits).setProps({
            minValue: Characteristic.TemperatureDisplayUnits.CELSIUS,
            maxValue: Characteristic.TemperatureDisplayUnits.FAHRENHEIT
        }).updateValue(this.tempUnit);
    }
};
