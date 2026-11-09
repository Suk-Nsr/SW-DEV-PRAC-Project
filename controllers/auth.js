const User = require('../models/Users');

const sendTokenResponse = (user, statusCode, res) => {
    const token = user.getSignedJwtToken();

    const options = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
        httpOnly: true
    };

    if (process.env.NODE_ENV === 'production') {
        options.secure = true;
    }

    res.status(statusCode).cookie('token', token, options).json({
        success: true,
        _id: user._id,
        name: user.name,
        email: user.email,
        tel: user.tel,
        role: user.role,
        token
    });
};

//@desc    Register user
//@route   POST /api/v1/auth/register
//@access  Public
exports.register = async (req, res, next) => {
    try {
        const { name, email, password, role, tel, telephone } = req.body;

        const phone = tel || telephone;
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Please provide a telephone number' });
        }

        const user = await User.create({
            name,
            email: typeof email === 'string' ? email.trim().toLowerCase() : email,
            password,
            role,
            tel: phone
        });

        sendTokenResponse(user, 201, res);
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
        console.log(err.stack);
    }
};

//@desc    Login user
//@route   POST /api/v1/auth/login
//@access  Public
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ success: false, msg: 'Please provide a valid email and password' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({ email: normalizedEmail }).select('+password');

        if (!user) {
            return res.status(400).json({ success: false, msg: 'Invalid credentials' });
        }

        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({ success: false, msg: 'Invalid credentials' });
        }

        sendTokenResponse(user, 200, res);
    } catch (err) {
        return res.status(401).json({ success: false, msg: 'Cannot convert email or password to string' });
    }
};

//@desc    Get current logged in user
//@route   GET /api/v1/auth/me
//@access  Private
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

//@desc    Log user out / clear cookie
//@route   GET /api/v1/auth/logout
//@access  Private
exports.logout = async (req, res, next) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });

    res.status(200).json({
        success: true,
        data: {}
    });
};

//@desc    Update user details (name, tel) - Extra Credit
//@route   PUT /api/v1/auth/updatedetails
//@access  Private
exports.updateDetails = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const fieldsToUpdate = {};
        if (req.body.name !== undefined) {
            const trimmedName = String(req.body.name).trim();
            if (!trimmedName) {
                return res.status(400).json({ success: false, message: 'Name cannot be empty' });
            }
            fieldsToUpdate.name = trimmedName;
        }

        const phone = req.body.tel || req.body.telephone;
        if (phone !== undefined) {
            const trimmedTel = String(phone).trim();
            if (!trimmedTel) {
                return res.status(400).json({ success: false, message: 'Telephone number cannot be empty' });
            }
            fieldsToUpdate.tel = trimmedTel;
        }

        const updatedUser = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: updatedUser
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

//@desc    Update user password - Extra Credit
//@route   PUT /api/v1/auth/updatepassword
//@access  Private
exports.updatePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both currentPassword and newPassword'
            });
        }

        if (typeof newPassword !== 'string' || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password must be different from current password'
            });
        }

        const user = await User.findById(req.user.id).select('+password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if current password matches
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        user.password = newPassword;
        await user.save();

        sendTokenResponse(user, 200, res);
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
