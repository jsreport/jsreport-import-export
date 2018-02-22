/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var _ExportModal = __webpack_require__(1);
	
	var _ExportModal2 = _interopRequireDefault(_ExportModal);
	
	var _ImportModal = __webpack_require__(5);
	
	var _ImportModal2 = _interopRequireDefault(_ImportModal);
	
	var _jsreportStudio = __webpack_require__(3);
	
	var _jsreportStudio2 = _interopRequireDefault(_jsreportStudio);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	_jsreportStudio2.default.addToolbarComponent(function (props) {
	  return React.createElement(
	    'div',
	    {
	      className: 'toolbar-button', onClick: function onClick() {
	        return _jsreportStudio2.default.openModal(_ExportModal2.default);
	      } },
	    React.createElement('i', { className: 'fa fa-download' }),
	    ' Export'
	  );
	}, 'settings');
	
	_jsreportStudio2.default.addToolbarComponent(function (props) {
	  return React.createElement(
	    'div',
	    {
	      className: 'toolbar-button', onClick: function onClick() {
	        return _jsreportStudio2.default.openModal(_ImportModal2.default);
	      } },
	    React.createElement('i', { className: 'fa fa-upload' }),
	    ' Import'
	  );
	}, 'settings');

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
	
	var _react = __webpack_require__(2);
	
	var _react2 = _interopRequireDefault(_react);
	
	var _jsreportStudio = __webpack_require__(3);
	
	var _jsreportStudio2 = _interopRequireDefault(_jsreportStudio);
	
	var _filesaver = __webpack_require__(4);
	
	var _filesaver2 = _interopRequireDefault(_filesaver);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
	
	function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }
	
	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
	
	function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }
	
	function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }
	
	var ExportModal = function (_Component) {
	  _inherits(ExportModal, _Component);
	
	  function ExportModal() {
	    _classCallCheck(this, ExportModal);
	
	    return _possibleConstructorReturn(this, (ExportModal.__proto__ || Object.getPrototypeOf(ExportModal)).apply(this, arguments));
	  }
	
	  _createClass(ExportModal, [{
	    key: 'componentWillMount',
	    value: function componentWillMount() {
	      var selections = {};
	
	      var references = _jsreportStudio2.default.getReferences();
	      Object.keys(references).forEach(function (k) {
	        Object.keys(references[k]).forEach(function (e) {
	          return selections[references[k][e]._id] = true;
	        });
	      });
	      this.setState(selections);
	    }
	  }, {
	    key: 'handleNodeSelect',
	    value: function handleNodeSelect(references, es, v) {
	      var updates = {};
	      references[es].forEach(function (e) {
	        updates[e._id] = v;
	      });
	
	      this.setState(updates);
	    }
	  }, {
	    key: 'download',
	    value: function () {
	      var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	        var _this2 = this;
	
	        var response;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                _context.prev = 0;
	                _context.next = 3;
	                return _jsreportStudio2.default.api.post('api/export', {
	                  data: {
	                    selection: Object.keys(this.state).filter(function (k) {
	                      return _this2.state[k];
	                    })
	                  },
	                  responseType: 'blob'
	                });
	
	              case 3:
	                response = _context.sent;
	
	
	                _filesaver2.default.saveAs(response, 'export.zip');
	                _context.next = 10;
	                break;
	
	              case 7:
	                _context.prev = 7;
	                _context.t0 = _context['catch'](0);
	
	                alert('Unable to prepare export ' + _context.t0.message + ' ' + _context.t0.stack);
	
	              case 10:
	              case 'end':
	                return _context.stop();
	            }
	          }
	        }, _callee, this, [[0, 7]]);
	      }));
	
	      function download() {
	        return _ref.apply(this, arguments);
	      }
	
	      return download;
	    }()
	  }, {
	    key: 'render',
	    value: function render() {
	      var _this3 = this;
	
	      var references = _jsreportStudio2.default.getReferences();
	      Object.keys(references).forEach(function (k) {
	        Object.keys(references[k]).forEach(function (e) {
	          return references[k][e] = Object.assign({}, references[k][e], { __selected: _this3.state[references[k][e]._id] });
	        });
	      });
	
	      return _react2.default.createElement(
	        'div',
	        { className: 'form-group' },
	        _react2.default.createElement(
	          'div',
	          null,
	          _react2.default.createElement(
	            'h1',
	            null,
	            _react2.default.createElement('i', { className: 'fa fa-download' }),
	            ' Export objects'
	          )
	        ),
	        _react2.default.createElement(
	          'div',
	          { style: { height: '30rem', overflow: 'auto' } },
	          _react2.default.createElement(_jsreportStudio.EntityTree, {
	            activeEntity: _jsreportStudio2.default.getActiveEntity(),
	            entities: references,
	            selectable: true,
	            onNodeSelect: function onNodeSelect(es, v) {
	              return _this3.handleNodeSelect(references, es, v);
	            },
	            onSelect: function onSelect(e, v) {
	              return _this3.setState(_defineProperty({}, e._id, !_this3.state[e._id]));
	            }
	          })
	        ),
	        _react2.default.createElement(
	          'div',
	          { className: 'button-bar' },
	          _react2.default.createElement(
	            'a',
	            { className: 'button confirmation', onClick: function onClick() {
	                return _this3.download();
	              } },
	            'Download'
	          )
	        )
	      );
	    }
	  }]);
	
	  return ExportModal;
	}(_react.Component);
	
	exports.default = ExportModal;

/***/ },
/* 2 */
/***/ function(module, exports) {

	module.exports = Studio.libraries['react'];

/***/ },
/* 3 */
/***/ function(module, exports) {

	module.exports = Studio;

/***/ },
/* 4 */
/***/ function(module, exports) {

	module.exports = Studio.libraries['filesaver.js-npm'];

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
	
	var _react = __webpack_require__(2);
	
	var _react2 = _interopRequireDefault(_react);
	
	var _jsreportStudio = __webpack_require__(3);
	
	var _jsreportStudio2 = _interopRequireDefault(_jsreportStudio);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }
	
	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
	
	function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }
	
	function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }
	
	var ImportModal = function (_Component) {
	  _inherits(ImportModal, _Component);
	
	  function ImportModal() {
	    _classCallCheck(this, ImportModal);
	
	    return _possibleConstructorReturn(this, (ImportModal.__proto__ || Object.getPrototypeOf(ImportModal)).apply(this, arguments));
	  }
	
	  _createClass(ImportModal, [{
	    key: 'upload',
	    value: function upload(e) {
	      var _this2 = this;
	
	      if (!e.target.files.length) {
	        return;
	      }
	
	      this.file = e.target.files[0];
	      var reader = new FileReader();
	
	      reader.onloadend = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
	        var result;
	        return regeneratorRuntime.wrap(function _callee$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                _this2.refs.file.value = '';
	
	                _context.prev = 1;
	                _context.next = 4;
	                return _jsreportStudio2.default.api.post('api/validate-import', {
	                  attach: { filename: 'import.zip', file: _this2.file }
	                });
	
	              case 4:
	                result = _context.sent;
	
	                _this2.setState(result);
	                _context.next = 11;
	                break;
	
	              case 8:
	                _context.prev = 8;
	                _context.t0 = _context['catch'](1);
	
	                _this2.setState({
	                  status: 1,
	                  log: _context.t0.message + ' ' + _context.t0.stack
	                });
	
	              case 11:
	              case 'end':
	                return _context.stop();
	            }
	          }
	        }, _callee, _this2, [[1, 8]]);
	      }));
	
	      reader.onerror = function () {
	        alert('There was an error reading the file!');
	      };
	
	      reader.readAsArrayBuffer(this.file);
	    }
	  }, {
	    key: 'import',
	    value: function () {
	      var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
	        return regeneratorRuntime.wrap(function _callee2$(_context2) {
	          while (1) {
	            switch (_context2.prev = _context2.next) {
	              case 0:
	                _context2.prev = 0;
	
	                this.setState({
	                  status: 1,
	                  log: 'Working on import....'
	                });
	                _context2.next = 4;
	                return _jsreportStudio2.default.api.post('api/import', {
	                  attach: { filename: 'import.zip', file: this.file }
	                });
	
	              case 4:
	                _context2.next = 9;
	                break;
	
	              case 6:
	                _context2.prev = 6;
	                _context2.t0 = _context2['catch'](0);
	                return _context2.abrupt('return', this.setState({
	                  status: 1,
	                  log: _context2.t0.message + ' ' + _context2.t0.stack
	                }));
	
	              case 9:
	
	                confirm('Import successful. We need to reload the studio.');
	                location.reload();
	
	              case 11:
	              case 'end':
	                return _context2.stop();
	            }
	          }
	        }, _callee2, this, [[0, 6]]);
	      }));
	
	      function _import() {
	        return _ref2.apply(this, arguments);
	      }
	
	      return _import;
	    }()
	  }, {
	    key: 'openFileDialog',
	    value: function openFileDialog() {
	      this.refs.file.dispatchEvent(new MouseEvent('click', {
	        'view': window,
	        'bubbles': false,
	        'cancelable': true
	      }));
	    }
	  }, {
	    key: 'render',
	    value: function render() {
	      var _this3 = this;
	
	      return _react2.default.createElement(
	        'div',
	        null,
	        _react2.default.createElement('input', { type: 'file', key: 'file', ref: 'file', style: { display: 'none' }, onChange: function onChange(e) {
	            return _this3.upload(e);
	          } }),
	        _react2.default.createElement(
	          'h1',
	          null,
	          _react2.default.createElement('i', { className: 'fa fa-upload' }),
	          ' Import objects'
	        ),
	        _react2.default.createElement(
	          'div',
	          { className: 'form-group' },
	          _react2.default.createElement(
	            'p',
	            null,
	            'You can safely upload the exported package and review the changes which will be performed. Afterwards you can reject or perform the import.'
	          ),
	          _react2.default.createElement(
	            'div',
	            { className: 'button-bar' },
	            _react2.default.createElement(
	              'a',
	              { className: 'button confirmation', onClick: function onClick() {
	                  return _this3.openFileDialog();
	                } },
	              'Validate'
	            )
	          )
	        ),
	        this.state ? _react2.default.createElement(
	          'div',
	          { className: 'form-group' },
	          _react2.default.createElement(
	            'div',
	            null,
	            _react2.default.createElement('textarea', { style: { width: '100%', boxSizing: 'border-box' }, rows: '10', readOnly: true, value: this.state.log })
	          ),
	          _react2.default.createElement(
	            'div',
	            { className: 'button-bar' },
	            _react2.default.createElement(
	              'a',
	              { className: 'button confirmation', onClick: function onClick() {
	                  return _this3.import();
	                } },
	              'Import'
	            )
	          )
	        ) : _react2.default.createElement('div', null)
	      );
	    }
	  }]);
	
	  return ImportModal;
	}(_react.Component);
	
	exports.default = ImportModal;
	
	
	(function (window) {
	  try {
	    new MouseEvent('test'); // eslint-disable-line
	    return false; // No need to polyfill
	  } catch (e) {}
	  // Need to polyfill - fall through
	
	
	  // Polyfills DOM4 MouseEvent
	
	  var MouseEvent = function MouseEvent(eventType, params) {
	    params = params || { bubbles: false, cancelable: false };
	    var mouseEvent = document.createEvent('MouseEvent');
	    mouseEvent.initMouseEvent(eventType, params.bubbles, params.cancelable, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
	
	    return mouseEvent;
	  };
	
	  MouseEvent.prototype = Event.prototype;
	
	  window.MouseEvent = MouseEvent;
	})(window);

/***/ }
/******/ ]);