// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb+srv://maheemshahreear2:7VK0LM6JxFpbxzCW@cluster0.urzuizl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Medicine Schema
const medicineSchema = new mongoose.Schema({
    name: { type: String, required: true },
    preparation: { type: String, required: true },
    category: { type: String, required: true },
    pricePerUnit: { type: Number, required: true },
    unitsAvailable: { type: Number, required: true },
    expiryDate: { type: Date, required: true },
    // New fields for different medicine types
    type: { type: String, enum: ['general', 'elderCare', 'momBabyCare', 'rareMedicine'], default: 'general' },
    
    // Elder Care specific fields
    ageGroup: { type: String },
    specialInstructions: { type: String },
    
    // Mom & Baby Care specific fields
    targetAge: { type: String },
    safetyNotes: { type: String },
    
    // Rare Medicine specific fields
    rarityLevel: { type: String },
    specialHandling: { type: String },
    clinicalNotes: { type: String }
}, { timestamps: true });

const Medicine = mongoose.model('Medicine', medicineSchema);

// Transaction Schema
const transactionSchema = new mongoose.Schema({
    medicineName: { type: String, required: true },
    preparation: { type: String, required: true },
    quantity: { type: Number, required: true },
    pricePerUnit: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    date: { type: Date, default: Date.now }
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

// Customer Schema
const customerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    product: { type: String, required: true },
    billPaid: { type: Number, required: true },
    date: { type: Date, default: Date.now }
}, { timestamps: true });

const Customer = mongoose.model('Customer', customerSchema);

// 📌 Normalize incoming category field
function normalizeCategory(body) {
    if (!body.category) {
        if (body.catagory) body.category = body.catagory; // typo fix
        if (body.type) body.category = body.type;         // alternate name fix
    }
    return body;
}

// 📍 GET all medicines
app.get('/api/medicines', async (req, res) => {
    try {
        const medicines = await Medicine.find();
        res.json(medicines);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 📍 GET medicines by type
app.get('/api/medicines/type/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const medicines = await Medicine.find({ type: type });
        res.json(medicines);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 📍 GET medicines by category
app.get('/api/medicines/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const medicines = await Medicine.find({ category: category });
        res.json(medicines);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 📍 SEARCH medicines with multiple criteria
app.get('/api/medicines/search', async (req, res) => {
    try {
        const { query, type, category, minPrice, maxPrice } = req.query;
        let searchCriteria = {};

        if (query) {
            searchCriteria.$or = [
                { name: { $regex: query, $options: 'i' } },
                { preparation: { $regex: query, $options: 'i' } },
                { category: { $regex: query, $options: 'i' } }
            ];
        }

        if (type) searchCriteria.type = type;
        if (category) searchCriteria.category = category;
        if (minPrice || maxPrice) {
            searchCriteria.pricePerUnit = {};
            if (minPrice) searchCriteria.pricePerUnit.$gte = parseFloat(minPrice);
            if (maxPrice) searchCriteria.pricePerUnit.$lte = parseFloat(maxPrice);
        }

        const medicines = await Medicine.find(searchCriteria);
        res.json(medicines);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 📍 GET medicine statistics by type
app.get('/api/medicines/stats/type', async (req, res) => {
    try {
        const stats = await Medicine.aggregate([
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    totalValue: { $sum: { $multiply: ['$pricePerUnit', '$unitsAvailable'] } },
                    avgPrice: { $avg: '$pricePerUnit' }
                }
            },
            {
                $project: {
                    type: '$_id',
                    count: 1,
                    totalValue: { $round: ['$totalValue', 2] },
                    avgPrice: { $round: ['$avgPrice', 2] }
                }
            }
        ]);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 📍 POST add new medicine
app.post('/api/medicines', async (req, res) => {
    try {
        const body = normalizeCategory(req.body);

        if (!body.category || typeof body.category !== 'string' || !body.category.trim()) {
            return res.status(400).json({ message: 'Category is required' });
        }

        const medicine = new Medicine({
            name: body.name,
            preparation: body.preparation,
            category: body.category.trim(),
            pricePerUnit: body.pricePerUnit,
            unitsAvailable: body.unitsAvailable,
            expiryDate: body.expiryDate,
            // New fields
            type: body.type || 'general',
            ageGroup: body.ageGroup,
            specialInstructions: body.specialInstructions,
            targetAge: body.targetAge,
            safetyNotes: body.safetyNotes,
            rarityLevel: body.rarityLevel,
            specialHandling: body.specialHandling,
            clinicalNotes: body.clinicalNotes
        });

        const savedMedicine = await medicine.save();
        res.status(201).json(savedMedicine);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// 📍 PUT update a medicine
app.put('/api/medicines/:id', async (req, res) => {
    try {
        const body = normalizeCategory(req.body);

        const updatedMedicine = await Medicine.findByIdAndUpdate(
            req.params.id,
            body,
            { new: true }
        );

        if (!updatedMedicine) {
            return res.status(404).json({ message: 'Medicine not found' });
        }

        res.json(updatedMedicine);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// 📍 PATCH update medicine stock
app.patch('/api/medicines/:id', async (req, res) => {
    try {
        const updatedMedicine = await Medicine.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!updatedMedicine) {
            return res.status(404).json({ message: 'Medicine not found' });
        }

        res.json(updatedMedicine);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// 📍 DELETE a medicine
app.delete('/api/medicines/:id', async (req, res) => {
    try {
        const deletedMedicine = await Medicine.findByIdAndDelete(req.params.id);
        if (!deletedMedicine) {
            return res.status(404).json({ message: 'Medicine not found' });
        }
        res.json({ message: 'Medicine deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 📍 GET medicines with low stock (units < 5)
app.get('/api/medicines/low-stock', async (req, res) => {
    try {
        const lowStockMedicines = await Medicine.find({
            unitsAvailable: { $lt: 5 }
        }).select('name unitsAvailable expiryDate category type preparation');
        
        res.json(lowStockMedicines);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 📍 GET medicines expiring soon (within 30 days)
app.get('/api/medicines/expiring-soon', async (req, res) => {
    try {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        const expiringSoonMedicines = await Medicine.find({
            expiryDate: { $lte: thirtyDaysFromNow }
        }).select('name unitsAvailable expiryDate category type preparation');
        
        res.json(expiringSoonMedicines);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 📍 GET all customers
app.get('/api/customers', async (req, res) => {
    try {
        const customers = await Customer.find().sort({ createdAt: -1 });
        res.json(customers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 📍 POST create new customer
app.post('/api/customers', async (req, res) => {
    try {
        const customer = new Customer(req.body);
        const savedCustomer = await customer.save();
        res.status(201).json(savedCustomer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// 📍 PUT update a customer
app.put('/api/customers/:id', async (req, res) => {
    try {
        const updatedCustomer = await Customer.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!updatedCustomer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        res.json(updatedCustomer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// 📍 DELETE a customer
app.delete('/api/customers/:id', async (req, res) => {
    try {
        const deletedCustomer = await Customer.findByIdAndDelete(req.params.id);
        if (!deletedCustomer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 📍 GET all transactions
app.get('/api/transactions', async (req, res) => {
    try {
        const transactions = await Transaction.find().sort({ date: -1 });
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 📍 POST create new transaction
app.post('/api/transactions', async (req, res) => {
    try {
        const transaction = new Transaction(req.body);
        const savedTransaction = await transaction.save();
        res.status(201).json(savedTransaction);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// 📍 POST create multiple transactions (for bulk sales)
app.post('/api/transactions/bulk', async (req, res) => {
    try {
        const { transactions } = req.body;
        if (!Array.isArray(transactions)) {
            return res.status(400).json({ message: 'Transactions must be an array' });
        }

        const savedTransactions = await Transaction.insertMany(transactions);
        res.status(201).json(savedTransactions);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
