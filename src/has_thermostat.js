// Homebridge plugin for Home Connect home appliances
// Copyright © 2021-2023 Alexander Thoukydides

let Service, Characteristic;

// Add Thermostats to an accessory
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

        // Get the current temp units and convert the limits if necessary
        let therm_min = 0;
        let therm_max = 0;
        if (thermSettings.unit === '°C') {
            this.debug('Setting units to C');
            this.tempUnit = Characteristic.TemperatureDisplayUnits.CELSIUS;
            therm_min = thermSettings.constraints.min;
            therm_max = thermSettings.constraints.max;
        } else {
            this.debug('Setting units to F');
            this.tempUnit = Characteristic.TemperatureDisplayUnits.FAHRENHEIT;
            therm_min = (thermSettings.constraints.min - 32) * 5 / 9;
            therm_max = (thermSettings.constraints.max - 32) * 5 / 9;
        }

        // Set the initial temps
        let temp = thermSettings.value;
        if (this.tempUnit === Characteristic.TemperatureDisplayUnits.FAHRENHEIT) {
            temp = (temp - 32) * 5 / 9;
        }
        service.updateCharacteristic(Characteristic.CurrentTemperature, temp);
        service.getCharacteristic(Characteristic.TargetTemperature).setProps({
            minValue: therm_min,
            maxValue: therm_max
        });
        service.updateCharacteristic(Characteristic.TargetTemperature, temp);

        this.device.on(key, item => {
            this.log('Current Temp ' + item.value);
            let temp = item.value;
            if (this.tempUnit === Characteristic.TemperatureDisplayUnits.FAHRENHEIT) {
                temp = (temp - 32) * 5 / 9;
            }
            service.updateCharacteristic(Characteristic.CurrentTemperature, temp);
            service.updateCharacteristic(Characteristic.TargetTemperature, temp);
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
            minValue: therm_min,
            maxValue: therm_max
        }).on('set', this.callbackify(async value => {
            this.debug('SET ' + name + ' ' + (value));
            let temp = value;
            if (this.tempUnit === Characteristic.TemperatureDisplayUnits.FAHRENHEIT) {
                temp = (value * 9 / 5) + 32;
            }
            temp = Math.round(temp);
            this.log('SET ' + name + ' ' + (temp));
            await this.device.setSetting(key, temp);
        }));

        service.getCharacteristic(Characteristic.TemperatureDisplayUnits).setProps({
            minValue: Characteristic.TemperatureDisplayUnits.CELSIUS,
            maxValue: Characteristic.TemperatureDisplayUnits.FAHRENHEIT
        }).updateValue(this.tempUnit);
    }
};
