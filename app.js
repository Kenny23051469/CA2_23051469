const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const session = require('express-session');
const app = express();

// Set up multer for file uploads
const feedback_storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images/feedback'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

// Set up multer for product file uploads
const product_storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images/products'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const feedback_upload = multer({ storage: feedback_storage });
const product_upload = multer({ storage: product_storage });

// Create MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'c237_cagassignment_kenny'
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set up view engine
app.set('view engine', 'ejs');

// Enable static files
app.use(express.static('public'));

// Enable form processing
app.use(express.urlencoded({ extended: false }));

// Set up session
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

// Define routes
app.get('/', (req, res) => {
    const sql = 'SELECT * FROM products ORDER BY RAND() LIMIT 4';
    connection.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving random products');
        }
        res.render('index', { products: results });
    });
});

// Other routes
app.get('/productslist', (req, res) => {
    const sql = 'SELECT * FROM products';
    connection.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving products');
        }
        res.render('productslist', { products: results, searchQuery: '' });
    });
});

app.get('/product/:id', (req, res) => {
    const productId = req.params.id;
    const sql = 'SELECT * FROM products WHERE productId = ?';
    const randomProductSQL = 'SELECT * FROM products WHERE productId != ? ORDER BY RAND() LIMIT 4';
    connection.query(sql, [productId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving product by ID');
        }
        if (results.length > 0) {
            connection.query(randomProductSQL, [productId], (error, randomProductsResults) => {
                if (error) {
                    console.error('Database query error:', error.message);
                    return res.status(500).send('Error retrieving random products');
                }

                res.render('product', { product: results[0], randomProducts: randomProductsResults });
            });
        } else {
            res.status(404).send('Product not found');
        }
    });
});

app.get('/addProduct', (req, res) => {
    res.render('addProduct');
});

app.post('/addProduct', product_upload.single('image'), (req, res) => {
    const { name, quantity, price, description } = req.body;
    let image;
    if (req.file) {
        image = req.file.filename;
    } else {
        image = null;
    }

    const sql = 'INSERT INTO products (productName, quantity, price, description, image) VALUES (?, ?, ?, ?, ?)';
    connection.query(sql, [name, quantity, price, description, image], (error, results) => {
        if (error) {
            console.error("Error adding product:", error);
            res.status(500).send('Error adding product');
        } else {
            res.redirect('/admin');
        }
    });
});

app.get('/editProduct/:id', (req, res) => {
    const productId = req.params.id;
    const sql = 'SELECT * FROM products WHERE productId = ?';
    connection.query(sql, [productId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving product by ID');
        }
        if (results.length > 0) {
            res.render('editProduct', { product: results[0] });
        } else {
            res.status(404).send('Product not found');
        }
    });
});

app.post('/editProduct/:id', product_upload.single('image'), (req, res) => {
    const productId = req.params.id;
    const { name, quantity, price, description } = req.body;
    let image = req.body.currentImage; // Retrieve current image filename from form

    // Check if a new image file is uploaded
    if (req.file) {
        image = req.file.filename; // Set image to the new uploaded file's filename
    }

    // SQL query to update the product in the database
    const sql = 'UPDATE products SET productName = ?, quantity = ?, price = ?, description = ?, image = ? WHERE productId = ?';

    // Execute the SQL query with parameters
    connection.query(sql, [name, quantity, price, description, image, productId], (error, results) => {
        if (error) {
            console.error("Error updating product:", error);
            res.status(500).send('Error updating product');
        } else {
            res.redirect('/admin'); // Redirect to the homepage after successful update
        }
    });
});

app.get('/deleteProduct/:id', (req, res) => {
    const productId = req.params.id;
    const sql = 'DELETE FROM products WHERE productId = ?';
    connection.query(sql, [productId], (error, results) => {
        if (error) {
            console.error("Error deleting product:", error);
            res.status(500).send('Error deleting product');
        } else {
            res.redirect('/admin');
        }
    });
});

// route to handle the search bar
app.get('/search', (req, res) => {
    // gets searchquery from searchbar and search products by name
    const searchQuery = req.query.query;
    const sql = 'SELECT * FROM products WHERE productName LIKE ?';
    const values = [`${searchQuery}%`];

    connection.query(sql, values, (err, results) => {
        // handles any errors
        if (err) {
            console.error('Error fetching products:', err);
            res.status(500).send('Internal Server Error');
        } else {
            // renders the searched products
            res.render('productslist', { products: results, searchQuery: searchQuery });
        }
    });
});

// Route to add a product to the cart
app.post('/addToCart/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const sql = 'SELECT * FROM products WHERE productId = ?';

    connection.query(sql, [productId], (error, results) => {
        // handles any errors
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving product by ID');
        }
        // checks if any product is found before adding it into the cart
        if (results.length > 0) {
            const product = results[0];
            if (!req.session.cart) {
                req.session.cart = [];
            }
            // handles any existing product which will increase the qty
            const existingProduct = req.session.cart.find(item => item.productId === productId);
            if (existingProduct) {
                existingProduct.quantity += 1;
            } else {
                product.quantity = 1;
                req.session.cart.push(product);
            }
            res.redirect('/cart');
        } else {
            res.status(404).send('Product not found');
        }
    });
});

// Route to remove an item from the cart
app.post('/removeFromCart/:id', (req, res) => {
    const productId = parseInt(req.params.id);

    // checks if there's a session cart
    if (req.session.cart) {
        const productIndex = req.session.cart.findIndex(item => item.productId === productId);

        // handles either removing a qty or product itself
        if (productIndex !== -1) {
            if (req.session.cart[productIndex].quantity > 1) {
                req.session.cart[productIndex].quantity -= 1;
            } else {
                req.session.cart.splice(productIndex, 1);
            }
        }
    }
    res.redirect('/cart');
});

app.get('/contact', (req, res) => {
    res.render('contact');
});

app.post('/submit-feedback', feedback_upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 }
]), (req, res) => {
    const { name, email, message } = req.body;

    // Ensure files are uploaded and accessible
    const image1 = req.files['image1'] ? req.files['image1'][0].filename : null;
    const image2 = req.files['image2'] ? req.files['image2'][0].filename : null;
    const image3 = req.files['image3'] ? req.files['image3'][0].filename : null;

    // Insert into MySQL
    const sql = 'INSERT INTO feedback (name, email, message, image1, image2, image3) VALUES (?, ?, ?, ?, ?, ?)';
    connection.query(sql, [name, email, message, image1, image2, image3], (err, result) => {
        if (err) {
            console.error('Error inserting feedback:', err);
            return res.status(500).send('Error submitting feedback');
        }
        console.log('Feedback submitted:', result);
        res.send('Feedback submitted successfully!');
    });
});

// Route to view the cart
app.get('/cart', (req, res) => {
    const cart = req.session.cart || [];
    res.render('cart', { cart });
});

app.get('/admin', (req, res) => {
    const sql = 'SELECT * FROM products';
    // Fetch data froom MySQL
    connection.query( sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving products');
        }
        // Render HTML page with data
        res.render('admin', { products: results});
    });
});

app.get('/feedbacklist', (req, res) => {
    const sql = 'SELECT * FROM feedback';
    // Fetch data froom MySQL
    connection.query( sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving feedback');
        }
        // Render HTML page with data
        res.render('feedbacklist', { feedback: results});
    });
});

app.get('/feedback/:id', (req, res) => {
    // Extract the feedback ID from the request parameters
    const feedbackid = req.params.id;
    const sql = 'SELECT * FROM feedback WHERE feedbackid = ?';
    // Fetch data from MySQL based on the feedback ID
    connection.query( sql, [feedbackid], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving feedback by ID');
        }
        // Check if any feedback with the given ID was found
        if (results.length > 0) {
            // Render HTML page with the feedback data
            res.render('feedback', { feedback: results[0] });
        } else {
            // If no feedback with the given ID was found, render a 404 page or handle it accordingly
            res.status(404).send('feedback not found');
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
