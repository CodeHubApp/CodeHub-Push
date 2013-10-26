CodeHub-Push
============

Push notification server built in Node.js for the iOS application CodeHub. 
This application has two endpoints: /register and /unregister. Registering requires an iOS device token, a username, and an O-Auth token
for that specific user. Using that information, the server will poll GitHub every X minutes for updates in
that user's notifications. If notifications are found, a push notification is generated for each and pushed out to the device.

Wan't to talk about it? Find me on Twitter at @thedillonb, or @codehubapp. 

CodeHub
-----------

[CodeHub](https://github.com/thedillonb/CodeHub) is an iOS application that I also created. The application is
designed using Xamarin.iOS (C#) and is currently avaiable in the [iTunes store](https://itunes.apple.com/us/app/codehub-github-for-ios/id707173885?mt=8).


Licence
-------------
Copyright 2012 Dillon Buchanan

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
