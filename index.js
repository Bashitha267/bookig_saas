require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const app = express();

const authRoutes = require('./routes/auth.routes');
const staffRoutes = require('./routes/staff.routes');
const adminRoutes = require('./routes/admin.routes');
const propertyRoutes = require('./routes/property.routes');
const roomRoutes = require('./routes/room.routes');
const bookingRoutes = require('./routes/booking.routes');
const paymentRoutes = require('./routes/payment.routes');
const ownerRoutes = require('./routes/owner.routes');

app.use(cors());
app.options(/.*/, cors());
app.use(compression());
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const PORT = process.env.PORT || 5000;

app.use('/auth', authRoutes);
app.use('/staff', staffRoutes);
app.use('/admin', adminRoutes);
app.use('/properties', propertyRoutes);
app.use('/rooms', roomRoutes);
app.use('/bookings', bookingRoutes);
app.use('/payments', paymentRoutes);
app.use('/owner', ownerRoutes);

app.get('/', (req, res) => {
  res.send('Villix SaaS API is running');
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
