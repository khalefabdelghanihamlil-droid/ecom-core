const productService = require('../services/product.service');

async function getProducts(req, res){

    try {

        const products = await productService.getAllProducts();

        res.json(products);

    } catch(error){

        res.status(error.status || 500).json({
            message: error.message
        });

    }

}
async function createProduct(req, res) {

    try {

        const product = req.body;

        const newProduct = await productService.createProduct(product);

        res.status(201).json(newProduct);

    } catch (error) {

        res.status(error.status || 500).json({
            message: error.message
        });

    }

}
async function getProductById(req, res) {

    try {

        const id = req.params.id;

        const product = await productService.getProductById(id);

        res.json(product);

    } catch (error) {

        res.status(error.status || 500).json({
            message: error.message
        });

    }

}
async function updateProduct(req, res) {

    try {

        const id = req.params.id;

        const product = req.body;

        const updatedProduct = await productService.updateProduct(id, product);

        res.json(updatedProduct);

    } catch (error) {

        res.status(error.status || 500).json({
            message: error.message
        });

    }

}
async function deleteProduct(req, res) {

    try {

        const id = req.params.id;

        const deletedProduct = await productService.deleteProduct(id);

        res.json({
            message: "Produit supprimé avec succès ✅",
            product: deletedProduct
        });

    } catch (error) {

        res.status(error.status || 500).json({
            message: error.message
        });

    }

}
module.exports = {
    getProducts,createProduct,getProductById,updateProduct,deleteProduct
};