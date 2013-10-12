CodeHub-Push
============

Push notification server built in Node.js for the iOS application CodeHub. 
This application has two endpoints: /register and /unregister. Registering requires an iOS device token, a username, and an O-Auth token
for that specific user. Using that information, the server will poll GitHub every X minutes for updates in
that user's notifications. If notifications are found, a push notification is generated for each and pushed out to the device.


