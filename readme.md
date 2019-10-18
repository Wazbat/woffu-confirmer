**Unnamed Woffu hour confirming tool**

How to use:
* Clone the repo
* Rename `.envexample` to `.env`
* Install dependencies with `npm i` or `yarn`
* Replace the fields with your credentials
* Run the script with `npm run start` or `yarn run start`

Automate hour confirmation by running this script via a scheduler. No maintenance should be required

Your password is saved in plaintext in the .env file. This is not secure at all, however my user did not have access to an API key, so I had to do it all this way instead. 

This tool is created by me for my personal use, not endorsed by any other person or company.

Nothing fancy. Just one big async function with a few reb requests, but it saves time.
