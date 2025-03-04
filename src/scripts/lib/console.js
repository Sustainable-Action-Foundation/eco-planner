"use strict";
/* eslint @typescript-eslint/no-explicit-any: 0 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.__console = void 0;
var colors_1 = require("./colors");
/* Modify console functions to color them */
exports.__console = __assign({}, console);
var consoleColors = {
    log: function (text) { return colors_1.colors.gray(text); },
    info: function (text) { return colors_1.colors.blue(text); },
    error: function (text) { return colors_1.colors.red(colors_1.colors.bold(text)); },
    warn: function (text) { return colors_1.colors.yellow(colors_1.colors.bold(text)); },
    debug: function (text) { return colors_1.colors.cyanBright(colors_1.colors.italic(text)); }
};
var _loop_1 = function (key, colorFunc) {
    console[key] = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (args.length === 1) {
            exports.__console[key](colorFunc(styleByType(args[0], { breakLine: true })));
        }
        else {
            (_a = exports.__console)[key].apply(_a, args.map(function (arg) { return colorFunc(styleByType(arg, { breakLine: true })); }));
        }
    };
};
for (var _i = 0, _a = Object.entries(consoleColors); _i < _a.length; _i++) {
    var _b = _a[_i], key = _b[0], colorFunc = _b[1];
    _loop_1(key, colorFunc);
}
function styleByType(value, options) {
    var type = Array.isArray(value) ? "array" : typeof value;
    if (type === "string")
        return value;
    else if (type === "object")
        return styleObject(value, options);
    else if (type === "array")
        return styleArray(value, options);
    else
        return value;
}
function styleArray(arr, option) {
    var open, comma, close;
    if (option === null || option === void 0 ? void 0 : option.breakLine) {
        open = "[\n  ";
        comma = ",\n  ";
        close = "\n]";
    }
    else {
        open = "[ ";
        comma = ", ";
        close = " ]";
    }
    return "".concat(open).concat(arr.join(comma)).concat(close);
}
function styleObject(obj, options) {
    var open, colon, comma, close;
    if (options === null || options === void 0 ? void 0 : options.breakLine) {
        open = "{\n  ";
        colon = ": ";
        comma = ",\n  ";
        close = "\n}";
    }
    else {
        open = "{ ";
        colon = ": ";
        comma = ", ";
        close = " }";
    }
    var entries = Object.entries(obj).map(function (_a) {
        var key = _a[0], value = _a[1];
        return "'".concat(key, "'").concat(colon).concat(styleByType(value, { breakLine: false }));
    });
    return "".concat(open).concat(entries.join(comma)).concat(close);
}
