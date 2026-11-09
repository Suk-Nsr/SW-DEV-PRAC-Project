const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const mongoSanitize = require('@exortek/express-mongo-sanitize');
const helmet = require('helmet');
const { xss } = require('express-xss-sanitizer');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');
const connectDB = require('./config/db');

// Load env vars
dotenv.config({ path: './config/config.env' });

// Connect to database
connectDB();

// Route files
const restaurants = require('./routes/restaurants');
const appointments = require('./routes/appointments');
const auth = require('./routes/auth');

const app = express();

const PORT = process.env.PORT || 5000;

// (1) Body parser & Cookie parser
app.use(express.json());
app.use(cookieParser());

// (2) Security middlewares
// Sanitize data (Prevent NoSQL Injection)
app.use(mongoSanitize());

// Set security headers
app.use(helmet());

// Prevent XSS attacks
app.use(xss());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 mins
    max: 100
});
app.use(limiter);

// Prevent http param pollutions (Express 5 fix)
app.use((req, res, next) => {
    Object.defineProperty(req, 'query', { value: { ...req.query }, writable: true });
    next();
});
app.use(hpp());

// Enable CORS
app.use(cors());

// Swagger Options
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Restaurant Reservation API',
            version: '1.0.0',
            description: 'A simple Express Restaurant Reservation API (Project #5)'
        },
        servers: [
            {
                url: `http://localhost:${PORT}/api/v1`
            }
        ]
    },
    apis: ['./routes/*.js']
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs));

// (3) Mount routers
app.use('/api/v1/restaurants', restaurants);
app.use('/api/v1/reservations', appointments);
app.use('/api/v1/appointments', appointments);
app.use('/api/v1/auth', auth);

const server = app.listen(PORT, console.log('Server running in ', process.env.NODE_ENV, ' mode on port ', PORT));

process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    server.close(() => process.exit(1));
});