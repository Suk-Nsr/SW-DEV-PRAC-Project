const fs = require("fs");
const path = require("path");

function makeItem(name, method, urlPath, headers, body, testLines, preReqLines) {
    const headerArr = [];
    if (headers) {
        for (const [k, v] of Object.entries(headers)) {
            headerArr.push({ key: k, value: v, type: "text" });
        }
    }
    const item = {
        name: name,
        request: {
            method: method,
            header: headerArr,
            url: {
                raw: "{{baseUrl}}" + urlPath,
                host: ["{{baseUrl}}"],
                path: urlPath.split("?")[0].split("/").filter(Boolean),
                query: []
            }
        },
        response: []
    };
    if (urlPath.includes("?")) {
        const queryStr = urlPath.split("?")[1];
        queryStr.split("&").forEach(pair => {
            const [qk, qv] = pair.split("=");
            item.request.url.query.push({ key: qk, value: qv });
        });
    }
    if (body) {
        item.request.body = {
            mode: "raw",
            raw: JSON.stringify(body, null, 4),
            options: {
                raw: {
                    language: "json"
                }
            }
        };
    }
    const events = [];
    if (preReqLines && preReqLines.length) {
        events.push({
            listen: "prerequest",
            script: {
                exec: preReqLines,
                type: "text/javascript"
            }
        });
    }
    if (testLines && testLines.length) {
        events.push({
            listen: "test",
            script: {
                exec: testLines,
                type: "text/javascript"
            }
        });
    }
    if (events.length) {
        item.event = events;
    }
    return item;
}

const masterItems = [];

// ==========================================
// 1. AUTH & USER PROFILE DOMAIN (Suk-Nsr)
// ==========================================

// 01. Register User (Valid)
masterItems.push(makeItem(
    "01. Auth - Register Test User (Valid with Telephone)",
    "POST",
    "/api/v1/auth/register",
    { "Content-Type": "application/json" },
    {
        name: "Sukrit User",
        tel: "0812345678",
        email: "master_user@test.com",
        password: "password123",
        role: "user"
    },
    [
        "pm.test('Status code is 200, 201 or 400', function () {",
        "    pm.expect(pm.response.code).to.be.oneOf([200, 201, 400]);",
        "});",
        "var jsonData = pm.response.json();",
        "if (jsonData.token) {",
        "    pm.environment.set('userToken', jsonData.token);",
        "    pm.collectionVariables.set('userToken', jsonData.token);",
        "}"
    ]
));

// 02. Register Duplicate Email (Expect 400)
masterItems.push(makeItem(
    "02. Auth - Register Duplicate Email (Expect 400)",
    "POST",
    "/api/v1/auth/register",
    { "Content-Type": "application/json" },
    {
        name: "Duplicate User",
        tel: "0811112222",
        email: "master_user@test.com",
        password: "password123",
        role: "user"
    },
    [
        "pm.test('Status code is 400 Bad Request', function () {",
        "    pm.response.to.have.status(400);",
        "});",
        "pm.test('Returns success false for duplicate email', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.false;",
        "});"
    ]
));

// 03. Register Missing Telephone (Expect 400)
masterItems.push(makeItem(
    "03. Auth - Register Missing Telephone (Expect 400)",
    "POST",
    "/api/v1/auth/register",
    { "Content-Type": "application/json" },
    {
        name: "Missing Tel User",
        email: "missing_tel@test.com",
        password: "password123",
        role: "user"
    },
    [
        "pm.test('Status code is 400 Bad Request', function () {",
        "    pm.response.to.have.status(400);",
        "});",
        "pm.test('Returns validation failure for missing telephone', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.false;",
        "});"
    ]
));

// 04. Login Test User (Valid)
masterItems.push(makeItem(
    "04. Auth - Login Test User (Valid)",
    "POST",
    "/api/v1/auth/login",
    { "Content-Type": "application/json" },
    {
        email: "master_user@test.com",
        password: "password123"
    },
    [
        "pm.test('Status code is 200 OK', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "pm.test('Token is received and stored', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.token).to.be.a('string');",
        "    pm.environment.set('userToken', jsonData.token);",
        "    pm.collectionVariables.set('userToken', jsonData.token);",
        "});"
    ]
));

// 05. Login Wrong Password (Expect 401)
masterItems.push(makeItem(
    "05. Auth - Login Wrong Password (Expect 401)",
    "POST",
    "/api/v1/auth/login",
    { "Content-Type": "application/json" },
    {
        email: "master_user@test.com",
        password: "completelyWrongPassword!"
    },
    [
        "pm.test('Status code is 401 Unauthorized', function () {",
        "    pm.response.to.have.status(401);",
        "});",
        "pm.test('Rejects invalid credentials', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.false;",
        "});"
    ]
));

// 06. Get Current User Profile (GET /me)
masterItems.push(makeItem(
    "06. Auth - Get Current User Profile (GET /me)",
    "GET",
    "/api/v1/auth/me",
    { "Authorization": "Bearer {{userToken}}" },
    null,
    [
        "pm.test('Status code is 200 OK', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "pm.test('Profile data contains telephone number', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.true;",
        "    pm.expect(jsonData.data.email).to.eql('master_user@test.com');",
        "    pm.expect(jsonData.data.tel || jsonData.data.telephone).to.exist;",
        "});"
    ]
));

// 07. Extra Credit: Update Profile Details (PUT /updatedetails)
masterItems.push(makeItem(
    "07. Extra Credit - Update Profile Details (PUT /updatedetails)",
    "PUT",
    "/api/v1/auth/updatedetails",
    {
        "Authorization": "Bearer {{userToken}}",
        "Content-Type": "application/json"
    },
    {
        name: "Sukrit Updated Name",
        tel: "0898765432"
    },
    [
        "pm.test('Status code is 200 OK', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "pm.test('User details updated successfully', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.true;",
        "    pm.expect(jsonData.data.name).to.eql('Sukrit Updated Name');",
        "    pm.expect(jsonData.data.tel || jsonData.data.telephone).to.eql('0898765432');",
        "});"
    ]
));

// 08. Extra Credit: Update Password (PUT /updatepassword)
masterItems.push(makeItem(
    "08. Extra Credit - Update Password (PUT /updatepassword)",
    "PUT",
    "/api/v1/auth/updatepassword",
    {
        "Authorization": "Bearer {{userToken}}",
        "Content-Type": "application/json"
    },
    {
        currentPassword: "password123",
        newPassword: "newpassword123"
    },
    [
        "pm.test('Status code is 200 OK', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "pm.test('Password changed and refreshed token returned', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.true;",
        "    pm.expect(jsonData.token).to.be.a('string');",
        "    pm.environment.set('userToken', jsonData.token);",
        "    pm.collectionVariables.set('userToken', jsonData.token);",
        "});"
    ]
));

// 09. Auth - Logout User
masterItems.push(makeItem(
    "09. Auth - Logout User (GET /logout)",
    "GET",
    "/api/v1/auth/logout",
    { "Authorization": "Bearer {{userToken}}" },
    null,
    [
        "pm.test('Status code is 200 OK', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "pm.test('Logout response is empty object', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.true;",
        "});"
    ]
));

// ==========================================
// 2. RESTAURANT MANAGEMENT DOMAIN (Suk-Nsr)
// ==========================================

// 10. Register Test Admin
masterItems.push(makeItem(
    "10. Auth - Register Test Admin (Setup)",
    "POST",
    "/api/v1/auth/register",
    { "Content-Type": "application/json" },
    {
        name: "Master Admin",
        tel: "0899999999",
        email: "master_admin@test.com",
        password: "password123",
        role: "admin"
    },
    [
        "pm.test('Status code is 200, 201 or 400', function () {",
        "    pm.expect(pm.response.code).to.be.oneOf([200, 201, 400]);",
        "});",
        "var jsonData = pm.response.json();",
        "if (jsonData.token) {",
        "    pm.environment.set('adminToken', jsonData.token);",
        "    pm.collectionVariables.set('adminToken', jsonData.token);",
        "}"
    ]
));

// 11. Login Admin
masterItems.push(makeItem(
    "11. Auth - Login Admin",
    "POST",
    "/api/v1/auth/login",
    { "Content-Type": "application/json" },
    {
        email: "master_admin@test.com",
        password: "password123"
    },
    [
        "pm.test('Status code is 200 OK', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "pm.test('Admin token is received and stored', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.token).to.be.a('string');",
        "    pm.environment.set('adminToken', jsonData.token);",
        "    pm.collectionVariables.set('adminToken', jsonData.token);",
        "});"
    ]
));

// 12. Public Browse Restaurants (Pagination & Filtering)
masterItems.push(makeItem(
    "12. Restaurant - Public Browse Restaurants with Pagination",
    "GET",
    "/api/v1/restaurants?page=1&limit=5",
    null,
    null,
    [
        "pm.test('Status code is 200 OK (Public Access)', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "pm.test('Response contains count and restaurant array', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.true;",
        "    pm.expect(jsonData.data).to.be.an('array');",
        "});"
    ]
));

// 13. Re-login Test User using the updated password
masterItems.push(makeItem(
    "13. Auth - Re-login Test User",
    "POST",
    "/api/v1/auth/login",
    { "Content-Type": "application/json" },
    {
        email: "master_user@test.com",
        password: "newpassword123"
    },
    [
        "pm.test('Status code is 200 OK', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "var jsonData = pm.response.json();",
        "pm.environment.set('userToken', jsonData.token);",
        "pm.collectionVariables.set('userToken', jsonData.token);"
    ]
));

// 14. Non-Admin Try Create Restaurant (Expect 403)
masterItems.push(makeItem(
    "14. Restaurant - Non-Admin Try Create Restaurant (Expect 403)",
    "POST",
    "/api/v1/restaurants",
    {
        "Authorization": "Bearer {{userToken}}",
        "Content-Type": "application/json"
    },
    {
        name: "Illegal User Restaurant " + Date.now(),
        address: "123 Unauthorized St",
        tel: "02-0000000",
        openCloseTime: "10:00 - 22:00"
    },
    [
        "pm.test('Status code is 403 Forbidden', function () {",
        "    pm.response.to.have.status(403);",
        "});",
        "pm.test('Rejects non-admin restaurant creation', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.false;",
        "});"
    ]
));

// 15. Admin Create Restaurant (Valid)
masterItems.push(makeItem(
    "15. Restaurant - Admin Create Restaurant (Valid)",
    "POST",
    "/api/v1/restaurants",
    {
        "Authorization": "Bearer {{adminToken}}",
        "Content-Type": "application/json"
    },
    {
        name: "Master Siam Gourmet " + Date.now(),
        address: "999 Rama 1 Rd, Pathumwan, Bangkok",
        tel: "02-9998888",
        openCloseTime: "10:00 - 22:00",
        tableCapacity: 20
    },
    [
        "pm.test('Status code is 201 Created or 200 or 400', function () {",
        "    pm.expect(pm.response.code).to.be.oneOf([201, 200, 400]);",
        "});",
        "var jsonData = pm.response.json();",
        "if (jsonData.data && jsonData.data._id) {",
        "    pm.environment.set('restaurantId', jsonData.data._id);",
        "    pm.collectionVariables.set('restaurantId', jsonData.data._id);",
        "}"
    ]
));

// 16. Get Restaurant ID fallback
masterItems.push(makeItem(
    "16. Restaurant - Get Restaurant ID (Ensure Valid ID)",
    "GET",
    "/api/v1/restaurants",
    null,
    null,
    [
        "pm.test('Status code is 200 OK', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "var jsonData = pm.response.json();",
        "pm.test('At least one restaurant exists', function () {",
        "    pm.expect(jsonData.data.length).to.be.greaterThan(0);",
        "});",
        "if (jsonData.data.length > 0) {",
        "    pm.environment.set('restaurantId', jsonData.data[0]._id);",
        "    pm.collectionVariables.set('restaurantId', jsonData.data[0]._id);",
        "}"
    ]
));

// 17. Get Single Restaurant by ID
masterItems.push(makeItem(
    "17. Restaurant - Get Single Restaurant by ID",
    "GET",
    "/api/v1/restaurants/{{restaurantId}}",
    null,
    null,
    [
        "pm.test('Status code is 200 OK', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "pm.test('Returns restaurant details matching ID', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.true;",
        "    pm.expect(jsonData.data._id).to.eql(pm.variables.get('restaurantId'));",
        "    pm.expect(jsonData.data.name).to.exist;",
        "    pm.expect(jsonData.data.openCloseTime).to.exist;",
        "});"
    ]
));

// 18. Admin Update Restaurant Details
masterItems.push(makeItem(
    "18. Restaurant - Admin Update Restaurant Details",
    "PUT",
    "/api/v1/restaurants/{{restaurantId}}",
    {
        "Authorization": "Bearer {{adminToken}}",
        "Content-Type": "application/json"
    },
    {
        tableCapacity: 25,
        openCloseTime: "10:00 - 22:00"
    },
    [
        "pm.test('Status code is 200 OK', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "pm.test('Restaurant capacity updated to 25', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.true;",
        "    pm.expect(jsonData.data.tableCapacity).to.eql(25);",
        "});"
    ]
));

// ==========================================
// 3. RESERVATION ENGINE DOMAIN (Alcanretia)
// ==========================================

// 19. Cleanup Old User Reservations
masterItems.push(makeItem(
    "19. Setup - Cleanup Old User Reservations (Idempotency)",
    "GET",
    "/api/v1/reservations",
    { "Authorization": "Bearer {{userToken}}" },
    null,
    [
        "pm.test('Status code is 200 OK', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "var jsonData = pm.response.json();",
        "if (jsonData.data && jsonData.data.length > 0) {",
        "    var token = pm.variables.get('userToken');",
        "    var baseUrl = pm.variables.get('baseUrl');",
        "    jsonData.data.forEach(function(item) {",
        "        pm.sendRequest({",
        "            url: baseUrl + '/api/v1/reservations/' + item._id,",
        "            method: 'DELETE',",
        "            header: { 'Authorization': 'Bearer ' + token }",
        "        }, function (err, res) {});",
        "    });",
        "}"
    ]
));

// 20. Reservation - Create Booking 1 (Valid)
masterItems.push(makeItem(
    "20. Reservation - Create Booking 1 (Valid)",
    "POST",
    "/api/v1/reservations",
    {
        "Authorization": "Bearer {{userToken}}",
        "Content-Type": "application/json"
    },
    {
        restaurant: "{{restaurantId}}",
        reservationDate: "2026-12-01T18:00:00.000Z",
        timeSlot: "18:00",
        tablesCount: 1,
        partySize: 4,
        specialRequests: "Window table requested"
    },
    [
        "pm.test('Status code is 201 Created', function () {",
        "    pm.response.to.have.status(201);",
        "});",
        "pm.test('Reservation 1 created and stored', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.true;",
        "    pm.expect(jsonData.data._id).to.exist;",
        "    pm.environment.set('reservationId1', jsonData.data._id);",
        "    pm.collectionVariables.set('reservationId1', jsonData.data._id);",
        "});"
    ]
));

// 21. Reservation - Get My Reservations
masterItems.push(makeItem(
    "21. Reservation - Get My Reservations",
    "GET",
    "/api/v1/reservations",
    { "Authorization": "Bearer {{userToken}}" },
    null,
    [
        "pm.test('Status code is 200 OK', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "pm.test('Returns user reservations array', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.true;",
        "    pm.expect(jsonData.data).to.be.an('array');",
        "    pm.expect(jsonData.count).to.be.at.least(1);",
        "});"
    ]
));

// 22. Reservation - Create Booking 2 (Valid)
masterItems.push(makeItem(
    "22. Reservation - Create Booking 2 (Valid)",
    "POST",
    "/api/v1/reservations",
    {
        "Authorization": "Bearer {{userToken}}",
        "Content-Type": "application/json"
    },
    {
        restaurant: "{{restaurantId}}",
        reservationDate: "2026-12-02T19:00:00.000Z",
        timeSlot: "19:00",
        tablesCount: 1
    },
    [
        "pm.test('Status code is 201 Created', function () {",
        "    pm.response.to.have.status(201);",
        "});",
        "var jsonData = pm.response.json();",
        "pm.environment.set('reservationId2', jsonData.data._id);",
        "pm.collectionVariables.set('reservationId2', jsonData.data._id);"
    ]
));

// 23. Reservation - Create Booking 3 (Valid - Hits 3-Table / 3-Booking Quota)
masterItems.push(makeItem(
    "23. Reservation - Create Booking 3 (Valid - Hits Quota Limit)",
    "POST",
    "/api/v1/reservations",
    {
        "Authorization": "Bearer {{userToken}}",
        "Content-Type": "application/json"
    },
    {
        restaurant: "{{restaurantId}}",
        reservationDate: "2026-12-03T20:00:00.000Z",
        timeSlot: "20:00",
        tablesCount: 1
    },
    [
        "pm.test('Status code is 201 Created', function () {",
        "    pm.response.to.have.status(201);",
        "});",
        "var jsonData = pm.response.json();",
        "pm.environment.set('reservationId3', jsonData.data._id);",
        "pm.collectionVariables.set('reservationId3', jsonData.data._id);"
    ]
));

// 24. Reservation - Create Booking 4 (Expect 400 - Quota Exceeded)
masterItems.push(makeItem(
    "24. Reservation - Create Booking 4 (Expect 400 - Quota Exceeded)",
    "POST",
    "/api/v1/reservations",
    {
        "Authorization": "Bearer {{userToken}}",
        "Content-Type": "application/json"
    },
    {
        restaurant: "{{restaurantId}}",
        reservationDate: "2026-12-04T18:00:00.000Z",
        timeSlot: "18:00",
        tablesCount: 1
    },
    [
        "pm.test('Status code is 400 Bad Request', function () {",
        "    pm.response.to.have.status(400);",
        "});",
        "pm.test('Quota error message matches expectation', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.false;",
        "    pm.expect(jsonData.message).to.satisfy(function(msg) {",
        "        return msg.includes('already made 3 reservations') || msg.includes('3-table quota');",
        "    });",
        "});"
    ]
));

// 25. Reservation - Try Booking Over 3 Tables in Single Request (Expect 400)
masterItems.push(makeItem(
    "25. Reservation - Single Booking Over 3 Tables (Expect 400)",
    "POST",
    "/api/v1/reservations",
    {
        "Authorization": "Bearer {{userToken}}",
        "Content-Type": "application/json"
    },
    {
        restaurant: "{{restaurantId}}",
        reservationDate: "2026-12-04T19:00:00.000Z",
        timeSlot: "19:00",
        tablesCount: 4
    },
    [
        "pm.test('Status code is 400 Bad Request', function () {",
        "    pm.response.to.have.status(400);",
        "});",
        "pm.test('Quota limit error message returned', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.false;",
        "});"
    ]
));

// 26. Extra Credit - Outside Opening Hours (Expect 400)
masterItems.push(makeItem(
    "26. Extra Credit - Outside Opening Hours (Expect 400)",
    "POST",
    "/api/v1/reservations",
    {
        "Authorization": "Bearer {{adminToken}}",
        "Content-Type": "application/json"
    },
    {
        restaurant: "{{restaurantId}}",
        reservationDate: "2026-12-05T03:00:00.000Z",
        timeSlot: "03:00",
        tablesCount: 1
    },
    [
        "pm.test('Status code is 400 Bad Request', function () {",
        "    pm.response.to.have.status(400);",
        "});",
        "pm.test('Error message indicates outside opening hours', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.false;",
        "    pm.expect(jsonData.message).to.include('outside the restaurant opening hours');",
        "});"
    ]
));

// 27. Extra Credit - Exceed Table Capacity (Expect 400)
masterItems.push(makeItem(
    "27. Extra Credit - Exceed Table Capacity (Expect 400)",
    "POST",
    "/api/v1/reservations",
    {
        "Authorization": "Bearer {{adminToken}}",
        "Content-Type": "application/json"
    },
    {
        restaurant: "{{restaurantId}}",
        reservationDate: "2026-12-05T18:00:00.000Z",
        timeSlot: "18:00",
        tablesCount: 9999
    },
    [
        "pm.test('Status code is 400 Bad Request', function () {",
        "    pm.response.to.have.status(400);",
        "});",
        "pm.test('Error message indicates capacity exceeded', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.false;",
        "    pm.expect(jsonData.message).to.include('capacity exceeded');",
        "});"
    ]
));

// 28. Reservation - Update Booking (> 2 Hours Ahead, Valid)
masterItems.push(makeItem(
    "28. Reservation - Update Booking (> 2 Hours Ahead, Valid)",
    "PUT",
    "/api/v1/reservations/{{reservationId1}}",
    {
        "Authorization": "Bearer {{userToken}}",
        "Content-Type": "application/json"
    },
    {
        specialRequests: "Quiet table updated"
    },
    [
        "pm.test('Status code is 200 OK', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "pm.test('Special requests updated successfully', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.true;",
        "    pm.expect(jsonData.data.specialRequests).to.eql('Quiet table updated');",
        "});"
    ]
));

// 29. Reservation - Delete Booking (> 2 Hours Ahead, Valid)
masterItems.push(makeItem(
    "29. Reservation - Delete Booking (> 2 Hours Ahead, Valid)",
    "DELETE",
    "/api/v1/reservations/{{reservationId3}}",
    { "Authorization": "Bearer {{userToken}}" },
    null,
    [
        "pm.test('Status code is 200 OK', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "pm.test('Reservation successfully deleted', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.true;",
        "});"
    ]
));

// ==========================================
// 4. EXTRA CREDIT & ADMIN OPERATIONS
// ==========================================

// 30. Extra Credit - Admin Export Reservations to CSV
masterItems.push(makeItem(
    "30. Extra Credit - Admin Export Reservations to CSV",
    "GET",
    "/api/v1/reservations/export?startDate=2026-01-01&endDate=2026-12-31",
    { "Authorization": "Bearer {{adminToken}}" },
    null,
    [
        "pm.test('Status code is 200 OK', function () {",
        "    pm.response.to.have.status(200);",
        "});",
        "pm.test('Content-Type is text/csv', function () {",
        "    pm.expect(pm.response.headers.get('Content-Type')).to.include('text/csv');",
        "});",
        "pm.test('CSV payload contains headers', function () {",
        "    var body = pm.response.text();",
        "    pm.expect(body).to.include('Reservation ID');",
        "    pm.expect(body).to.include('User Name');",
        "    pm.expect(body).to.include('Restaurant Name');",
        "});"
    ]
));

// 31. Extra Credit - Non-Admin Try Export CSV (Expect 403)
masterItems.push(makeItem(
    "31. Extra Credit - Non-Admin Try Export CSV (Expect 403)",
    "GET",
    "/api/v1/reservations/export",
    { "Authorization": "Bearer {{userToken}}" },
    null,
    [
        "pm.test('Status code is 403 Forbidden', function () {",
        "    pm.response.to.have.status(403);",
        "});",
        "pm.test('Rejects non-admin CSV export access', function () {",
        "    var jsonData = pm.response.json();",
        "    pm.expect(jsonData.success).to.be.false;",
        "});"
    ]
));

const masterCollection = {
    info: {
        _postman_id: "77eec40a-1234-4567-89ab-cdef01234567",
        name: "Master Restaurant Reservation System Test Suite",
        description: "Self-contained and idempotent Master Newman/Postman automated test suite covering Auth & User Profile Management (Suk-Nsr), Restaurant Management (Suk-Nsr), and Reservation Engine Domain (Alcanretia) with 100% automated assertions for Baseline and Extra Credit features.",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    variable: [
        { key: "baseUrl", value: "http://localhost:5000", type: "string" },
        { key: "userToken", value: "", type: "string" },
        { key: "adminToken", value: "", type: "string" },
        { key: "restaurantId", value: "", type: "string" },
        { key: "reservationId1", value: "", type: "string" },
        { key: "reservationId2", value: "", type: "string" },
        { key: "reservationId3", value: "", type: "string" }
    ],
    item: masterItems
};

const outputPath = path.resolve(__dirname, "..", "Master_Restaurant_Reservation_API.postman_collection.json");
fs.writeFileSync(outputPath, JSON.stringify(masterCollection, null, 2));
console.log("Master Collection generated successfully at:", outputPath);
console.log("Total items:", masterItems.length);
