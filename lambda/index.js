const Alexa = require('ask-sdk-core');
const HomeAssistantAPI = require('https')
const endpoint_url = process.env.HASS_ENDPOINT

// English: You can ask me how much power the house, living room or something else is using. Or you can ask me how much energy did the house, living room or other consume today, this week or this month.
const helpText = 'Puoi chiedermi quanto sta consumando casa, sala o altro. Oppure puoi chiedermi quanto ha consumato casa, sala o altro oggi, questa settimana o questo mese.';

async function get_home_assistant_current_state(state) {
    path = '/states/' + state
    return new Promise(function (resolve, reject) {
        options = {headers: {"Authorization": "Bearer " + process.env.HASS_TOKEN}}
        HomeAssistantAPI.get(endpoint_url + path, options, (resp) => {
            let data = '';
            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
              data += chunk;
            });

            // The whole response has been received. Print out the result.
            resp.on('end', () => {

                try {
                    let API_data = JSON.parse(data);
                    if (!API_data.hasOwnProperty('message')) {
                        resolve(API_data["state"])
                    }
                    else
                    {
                        console.log('API error: ' + data)
                        reject('Errore riportato dalla API')
                    }
                }
                catch (e)
                {
                    console.log('Error calling API' + e)
                    reject(e)
                }
            })

        }).on("error", (err) => {
        console.log("Error: " + err.message);
        reject(err)
        });
    });
}

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        // English: Welcome home
        const speakOutput = `Benvenuto in casa. ${helpText}`;
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

function roundToString(value, decimalPlaces = 1) {
    // Replacing . with , because here in Italy , is the decimal separator, not .
    return Number(value).toFixed(decimalPlaces).toString().replace(".", ",");
}

const InstantPowerUsageIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'InstantPowerUsageIntent';
    },
    async handle(handlerInput) {
        try {
            let consumption_device = Alexa.getSlotValue(handlerInput.requestEnvelope, "What") || 'casa'; // English: house
            console.log(`consumption_device = ${consumption_device}`)
            let power = parseFloat(await get_home_assistant_current_state("sensor.potenza_" + consumption_device))
            let power_string = power >= 1000 ? `${roundToString(power/1000)} kilowatt` : `${roundToString(power)} watt` 

            // English: ${consumption_device} is consuming ${power_string}
            const speakOutput = `${consumption_device} sta consumando ${power_string}`;
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
        } catch(e) {
            console.log(handlerInput.requestEnvelope.request.intent.slots)
            console.log(e)
            return handlerInput.responseBuilder
            .speak("ERRORE") // English: Error
            .getResponse();
        }
    }
};

function getSlotId(slot) {
    if ("slotValue" in slot) {
        return slot.slotValue.resolutions.resolutionsPerAuthority[0].values[0].value.id;
    } else {
        return false;
    }
}

const HistoricEnergyUsageIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HistoricEnergyUsageIntent';
    },
    async handle(handlerInput) {
        try {
            let consumption_device = getSlotId(Alexa.getSlot(handlerInput.requestEnvelope, "What")) || 'casa'; // English: House
            let historic_time = getSlotId(Alexa.getSlot(handlerInput.requestEnvelope, "When")) || 'giorno'; // English: day
            let historic_time_name = Alexa.getSlotValue(handlerInput.requestEnvelope, "When") || 'oggi'; // English: today

            console.log(`consumption_device = ${consumption_device}`)
            console.log(`historic_time = ${historic_time}`)

            // The following is due to the way I structured my energy meters in Home Assistant:
            // - They all have the sensor.energia_ prefix (energia = energy)
            // - Then there is the timing suffix: giornaliera (= daily), settimanale (= weekly) or mensile (= monthly)
            // - Finally, there is the "room" name (except for the whole house, which has no name)
            // e.g.: sensor.energia_settimanale_sala = energy used this week by the living room lights
            var sensor = "sensor.energia_";

            switch (historic_time) {
                case 'settimana':
                    sensor += "settimanale";
                    break;
                case 'mese':
                    sensor += "mensile";
                    break;
                default:
                case 'giorno':
                    sensor += "giornaliera";
                    break;
            }
            if (consumption_device != "casa") {
                sensor += "_" + consumption_device;
            }

            console.log(`sensor = ${sensor}`)

            let energy = parseFloat(await get_home_assistant_current_state(sensor))
            let energy_string = energy >= 1 ? `${roundToString(energy)} kilowatt` : `${roundToString(energy*1000)} watt` 
            console.log(energy, energy_string)

            // English: ${consumption_device} used ${energy_string}-hour ${historic_time_name}
            // e.g. House used 2 kilowatt-hour today
            const speakOutput = `${consumption_device} ha consumato ${energy_string}-ora ${historic_time_name}`;
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
        } catch(e) {
            console.log(handlerInput.requestEnvelope.request.intent.slots)
            console.log(e)
            return handlerInput.responseBuilder
            .speak("ERRORE") // English: Error
            .getResponse();
        }
    }
};

const HeatingCoolingDurationIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && ['HeatingDurationTodayIntent', 'CoolingDurationTodayIntent'].includes(Alexa.getIntentName(handlerInput.requestEnvelope));
    },
    async handle(handlerInput) {
        let what = Alexa.getIntentName(handlerInput.requestEnvelope) === 'HeatingDurationTodayIntent' ? "riscaldamento" : "clima"; // English: riscaldamento = heating, clima = a/c
        let duration = await get_home_assistant_current_state(`sensor.tempo_${what}_oggi`)
        // English: ${what} was on for ${duration} hours today
        const speakOutput = `Il ${what} ha lavorato ${duration} ore oggi`;
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak(helpText)
            .reprompt(helpText)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.stack}`);
        // English: Unfortunately there's been an error
        const speakOutput = `Purtroppo c'è stato un errore.`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        InstantPowerUsageIntentHandler,
        HistoricEnergyUsageIntentHandler,
        HeatingCoolingDurationIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        )
    .addErrorHandlers(
        ErrorHandler,
        )
    .lambda();
