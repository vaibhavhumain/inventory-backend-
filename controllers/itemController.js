const Item = require('../models/item');

exports.createItem = async(req,res) => {
    try{
        const item = await Item.create(req.body);
        res.status(201).json(item);
    } catch(error){
    res.status(400).json({error: error.message});
}
};

exports.getItems = async(req,res) => {
    try {
        const items = await Item.find();
        res.status(200).json(items);
    } catch(error) {
        res.status(500).json({error: error.message});
    }
}

exports.getItemById = async (req,res) => {
    try{
        const item = await item.findById(req.params.id);
        if(!item) {
            return res.status(404).json({error: 'Item not found'});
        }
        res.status(200).json(item);
    } catch(error) {
        res.status(500).json({error: error.message});
    }
};

exports.updateItem = async (req,res) => {
    try {
        const updatedItem = await item.findByIdAndUpdate(
            req.params.id,
            req.body,
            {new: true, runVaildators: true}
        );
        if(!updatedItem) {
            return res.status(400).json({error: 'Item not found'});
        }
        res.statys(200).json(updatedItem);
    } catch(error) {
        res.status(400).json({error: error.message});
    }
};

exports.deleteItem = async (req,res) =>{
    try {
        const deleteItem = await item.findByIdAndDelete(req.params.id);
        if(!deleteItem) {
            return res.status(404).json({error:'Item not found'});
        } res.status(200).json({message: 'Item deleted successfully'});
    } catch(error) {
        res.status(500).json({error: error.message});
    }
}