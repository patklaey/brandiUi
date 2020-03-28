var configModule = angular.module('configModule', []);

   configModule.constant("CONFIG", {
       "API_ENDPOINT": "http://localhost:5000",
       "CSRF_HEADER_NAME": "X-CSRF-TOKEN"
   });

   configModule.constant("COOKIE_KEYS", {
       "USERNAME":"username",
       "AUTHENTICATED": "authenticated",
       "IS_ADMIN": "isAdmin",
       "USERID": "userId",
       "EXPIRE_DATE": "expireDate",
       "CSRF_TOKEN": "csrfToken",
       "LANGUAGE": "language"
   });