This is a (very) custom Alexa skill to interact with my Home Assistant instance.
It was developed for my own usage (in Italian), but I tried to add comments explaining what all the phrases mean in English.

It enables me to:
 - Check how long was the heating or a/c on today
 - How much power is currently being used by a few rooms/devices/the whole house
 - How much energy has been consumed by a few rooms/devices/the whole house today/in the last week/in the last month.

# What you need to change
The most important thing is to implement the code that "generates" your entity ids based on what you need to check (for example today's whole-house energy usage). This is found in `InstantPowerUsageIntentHandler`, `HistoricEnergyUsageIntentHandler`.
You should do the same in `DurataRiscaldamentoClimaOggiIntentHandler` to point to the entity you use to calculate the number of hours heating and air conditioning have been on for today.
Don't forget the [interaction models](https://github.com/LucaTNT/alexa-casa/tree/main/skill-package/interactionModels/custom/).

 # How to deploy
 This skill is supposed to be deployed to AWS Lambda through [ask-cli](https://developer.amazon.com/en-US/docs/alexa/smapi/quick-start-alexa-skills-kit-command-line-interface.html).

 Adapt the code to fit your Home Assistant entities (be sure not to forget the [interaction models](tree/main/skill-package/intractionModels/custom/)), then deploy using:

    ask deploy

(Maybe you need to first create your own skill with `ask new` and then copy the code over? I'm not really sure.)

## Environment variables
In order to avoid having the Home Assistant API URL and [Long-lived access token](https://developers.home-assistant.io/docs/auth_api/#long-lived-access-token) in the code, I supply them as environment variables to the Lambda function.

This is not really supported by `ask-cli`, but there's a workaround:
- Deploy the skill
- In your AWS Console, go to Lambda and then open the function that powers this skill
- Add two environment variables:
  - `HASS_ENDPOINT` should be something like `https://my-home-assistant-instance.com/api`
  - `HASS_TOKEN` is your [Long-lived access token](https://developers.home-assistant.io/docs/auth_api/#long-lived-access-token)
- The next time you edit the code and try to deploy, `ask-cli` will complain that you changed something in the Lambda function. Ignore the error and deploy with `ask deploy --ignore-hash`. Your environment variables will be preserved.

# Disclaimer
As I said, this was developed for my own usage, I then decided to spend a little time to document what I did and to publish the code here.
