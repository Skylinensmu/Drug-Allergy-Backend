const jwt = require('jsonwebtoken');
const secretKey = "DrugallergySecretkey"

function verifyToken(req, res, next) {
    
    const token = req.headers.authorization;

    
    if (!token) {
        return res.status(401).json({ error: 'Token not provided' });
    }

    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        req.userId = decoded.userId;
        next();
    });
}

module.exports = verifyToken;