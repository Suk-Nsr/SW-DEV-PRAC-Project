# Restaurant Reservation System (Project #5)

A backend RESTful API system for restaurant reservations developed as part of **2110503 Software Development Practice (Academic Year 2569)**.

---

## Team Members
* **Suk-Nsr** - User Identity & Restaurant Management Domain
* **Alcanratia** - Reservation Engine & Booking Rules Domain

---

## Requirements

### Baseline Requirements
1. The system shall allow a user to register by specifying the name, telephone number, email, and password.
2. After registration, the user becomes a registered user, and the system shall allow the user to log in to use the system by specifying the email and password. The system shall allow a registered user to log out.
3. After login, the system shall allow the registered user to reserve up to 3 tables by specifying the date and the preferred restaurant. The restaurant list is also provided to the user. A restaurant information includes the name, address, telephone number, and open-close time.
4. The system shall allow the registered user to view his/her restaurant reservation.
5. The system shall allow the registered user to edit his/her restaurant reservation.
6. The system shall allow the registered user to delete his/her restaurant reservation.
7. The system shall allow the admin to view any restaurant reservation.
8. The system shall allow the admin to edit any restaurant reservation.
9. The system shall allow the admin to delete any restaurant reservation.

### Extra Credit Requirements
1. The system shall allow the registered user to select a specific dining time slot (within the restaurant's open hours) on the reservation date, and automatically prevent bookings if the restaurant's table capacity is fully booked for that slot.
2. The system shall allow a registered user to view and update their profile details (name and telephone number) and change their password by verifying their current password.
3. The system shall enforce a cancellation and modification cutoff, permitting a registered user to edit or delete a reservation only if there are at least 2 hours remaining before the reserved time.
4. The system shall send an automated reservation confirmation email to the registered user upon successful booking, modification, or cancellation via a third-party email service (e.g., SendGrid or Resend).
5. The system shall allow the admin to export all reservation records within a selected date range as a downloadable CSV file.
6. The system shall allow the registered user to specify the guest count (party size) and provide optional dietary requirements or special requests (e.g., food allergies, seating preferences) when creating a reservation.

---

## Project Plan & Team Workflow
For the detailed task breakdown, status tracking, Git branching policy, and presentation schedule, please refer to:
* [PROJECT_PLAN.md](PROJECT_PLAN.md)

---

## Getting Started

### 1. Prerequisites
* Node.js (v18 or higher recommended)
* npm
* MongoDB Atlas Database URI

### 2. Installation
```bash
npm install
```

### 3. Environment Configuration
Create a `config/config.env` file by copying the template:
```bash
cp config/config.env.example config/config.env
```
Fill in the required configuration variables:
```env
NODE_ENV=development
PORT=5000
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_secret_key
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30
```

### 4. Running the Application
* **Development mode (with nodemon):**
  ```bash
  npm run dev
  ```
* **Production mode:**
  ```bash
  npm start
  ```
* **API Documentation (Swagger UI):**
  Once the server is running, visit:
  ```
  http://localhost:5000/api-docs
  ```
