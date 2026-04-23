require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

const authRoutes = require('./routes/auth.routes');
const staffRoutes = require('./routes/staff.routes');
const adminRoutes = require('./routes/admin.routes');

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.use('/auth', authRoutes);
app.use('/staff', staffRoutes);
app.use('/admin', adminRoutes);

app.get('/', (req, res) => {
  res.send('Villix SaaS API is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
