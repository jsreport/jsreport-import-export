/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
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
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 2);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports) {

module.exports = Studio;

/***/ }),
/* 1 */
/***/ (function(module, exports) {

module.exports = Studio.libraries['react'];

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _ExportModal = __webpack_require__(3);

var _ExportModal2 = _interopRequireDefault(_ExportModal);

var _ImportModal = __webpack_require__(5);

var _ImportModal2 = _interopRequireDefault(_ImportModal);

var _jsreportStudio = __webpack_require__(0);

var _jsreportStudio2 = _interopRequireDefault(_jsreportStudio);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_jsreportStudio2.default.addToolbarComponent(function (props) {
  return React.createElement(
    'div',
    { className: 'toolbar-button', onClick: function onClick() {
        return _jsreportStudio2.default.openModal(_ExportModal2.default);
      } },
    React.createElement('i', { className: 'fa fa-download' }),
    ' Export'
  );
}, 'settings');

_jsreportStudio2.default.addToolbarComponent(function (props) {
  return React.createElement(
    'div',
    { className: 'toolbar-button', onClick: function onClick() {
        return _jsreportStudio2.default.openModal(_ImportModal2.default);
      } },
    React.createElement('i', { className: 'fa fa-upload' }),
    ' Import'
  );
}, 'settings');

_jsreportStudio2.default.addEntityTreeContextMenuItemsResolver(function (_ref) {
  var node = _ref.node,
      entity = _ref.entity,
      isRoot = _ref.isRoot,
      isGroupEntity = _ref.isGroupEntity,
      getAllEntitiesInHierarchy = _ref.getAllEntitiesInHierarchy;

  var items = [];

  if (isRoot) {
    items.push({
      key: 'Import',
      title: 'Import',
      icon: 'fa-upload',
      onClick: function onClick() {
        _jsreportStudio2.default.openModal(_ImportModal2.default);
      }
    });

    items.push({
      key: 'Export',
      title: 'Export',
      icon: 'fa-download',
      onClick: function onClick() {
        _jsreportStudio2.default.openModal(_ExportModal2.default);
      }
    });
  } else if (isGroupEntity && entity.__entitySet === 'folders') {
    items.push({
      key: 'Import',
      title: 'Import into folder',
      icon: 'fa-upload',
      onClick: function onClick() {
        _jsreportStudio2.default.openModal(_ImportModal2.default, { selectedFolderShortid: entity.shortid });
      }
    });

    items.push({
      key: 'Export',
      title: 'Export folder',
      icon: 'fa-download',
      onClick: function onClick() {
        var selected = getAllEntitiesInHierarchy(node, true);
        _jsreportStudio2.default.openModal(_ExportModal2.default, { initialSelected: selected });
      }
    });
  }

  return {
    grouped: true,
    items: items
  };
});

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = __webpack_require__(1);

var _react2 = _interopRequireDefault(_react);

var _jsreportStudio = __webpack_require__(0);

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
      var options = this.props.options;

      var selections = {};

      var references = _jsreportStudio2.default.getReferences();
      Object.keys(references).forEach(function (k) {
        Object.keys(references[k]).forEach(function (e) {
          if (options.initialSelected != null) {
            var selected = Array.isArray(options.initialSelected) ? options.initialSelected : [options.initialSelected];

            selected.forEach(function (s) {
              if (references[k][e]._id === s) {
                selections[references[k][e]._id] = true;
              } else if (selections[references[k][e]._id] == null) {
                selections[references[k][e]._id] = false;
              }
            });
          } else {
            selections[references[k][e]._id] = true;
          }
        });
      });
      this.setState(selections);
    }
  }, {
    key: 'handleNodeSelect',
    value: function handleNodeSelect(references, es, v) {
      var updates = {};

      if (Array.isArray(es)) {
        es.forEach(function (_id) {
          updates[_id] = v;
        });
      } else {
        references[es].forEach(function (e) {
          updates[e._id] = v;
        });
      }

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
                }, true);

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

/***/ }),
/* 4 */
/***/ (function(module, exports) {

module.exports = Studio.libraries['filesaver.js-npm'];

/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = __webpack_require__(1);

var _react2 = _interopRequireDefault(_react);

var _jsreportStudio = __webpack_require__(0);

var _jsreportStudio2 = _interopRequireDefault(_jsreportStudio);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EntityRefSelect = _jsreportStudio2.default.EntityRefSelect;

var ImportFinishedModal = function (_Component) {
  _inherits(ImportFinishedModal, _Component);

  function ImportFinishedModal() {
    _classCallCheck(this, ImportFinishedModal);

    return _possibleConstructorReturn(this, (ImportFinishedModal.__proto__ || Object.getPrototypeOf(ImportFinishedModal)).apply(this, arguments));
  }

  _createClass(ImportFinishedModal, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      var _this2 = this;

      setTimeout(function () {
        return _this2.confirmBtn.focus();
      }, 0);
    }
  }, {
    key: 'componentWillUnmount',
    value: function componentWillUnmount() {
      _jsreportStudio2.default.reset().catch(function () {});
    }
  }, {
    key: 'confirm',
    value: function confirm() {
      this.props.close();

      _jsreportStudio2.default.reset().catch(function (e) {
        console.error(e);
      });
    }
  }, {
    key: 'render',
    value: function render() {
      var _this3 = this;

      var log = this.props.options.log;


      return _react2.default.createElement(
        'div',
        null,
        _react2.default.createElement(
          'h1',
          null,
          _react2.default.createElement('i', { className: 'fa fa-info-circle' }),
          ' Import finished'
        ),
        log != null && log !== '' && _react2.default.createElement(
          'div',
          { className: 'form-group' },
          _react2.default.createElement(
            'div',
            null,
            _react2.default.createElement(
              'i',
              null,
              'Some errors/warnings happened during the import:'
            )
          ),
          _react2.default.createElement('textarea', { style: { width: '100%', boxSizing: 'border-box' }, rows: '10', readOnly: true, value: log })
        ),
        _react2.default.createElement(
          'div',
          { className: 'form-group' },
          _react2.default.createElement(
            'i',
            null,
            'Now we need to reload the studio..'
          )
        ),
        _react2.default.createElement(
          'div',
          { className: 'button-bar' },
          _react2.default.createElement(
            'button',
            { ref: function ref(el) {
                _this3.confirmBtn = el;
              }, className: 'button confirmation', onClick: function onClick() {
                return _this3.confirm();
              } },
            'Ok'
          )
        )
      );
    }
  }]);

  return ImportFinishedModal;
}(_react.Component);

var ImportModal = function (_Component2) {
  _inherits(ImportModal, _Component2);

  function ImportModal(props) {
    _classCallCheck(this, ImportModal);

    var _this4 = _possibleConstructorReturn(this, (ImportModal.__proto__ || Object.getPrototypeOf(ImportModal)).call(this, props));

    _this4.state = {
      selectedFolderShortid: props.options != null && props.options.selectedFolderShortid ? props.options.selectedFolderShortid : null,
      fullImport: false,
      validated: false
    };
    return _this4;
  }

  _createClass(ImportModal, [{
    key: 'upload',
    value: function upload(e) {
      var _this5 = this;

      if (!e.target.files.length) {
        return;
      }

      this.setState({
        status: '1',
        processing: true,
        log: 'Validating import....'
      });

      this.file = e.target.files[0];
      var reader = new FileReader();

      reader.onloadend = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var result;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _this5.refs.file.value = '';

                _context.prev = 1;
                _context.next = 4;
                return _jsreportStudio2.default.api.post('api/validate-import', {
                  params: {
                    fullImport: _this5.state.fullImport,
                    targetFolder: _this5.state.selectedFolderShortid
                  },
                  attach: { filename: 'import.zip', file: _this5.file }
                }, true);

              case 4:
                result = _context.sent;


                _this5.setState({
                  validated: true,
                  status: result.status,
                  processing: false,
                  log: result.log
                });
                _context.next = 11;
                break;

              case 8:
                _context.prev = 8;
                _context.t0 = _context['catch'](1);

                _this5.setState({
                  validated: true,
                  status: '1',
                  processing: false,
                  log: _context.t0.message + ' ' + _context.t0.stack
                });

              case 11:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, _this5, [[1, 8]]);
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
        var result;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.prev = 0;

                this.setState({
                  status: '1',
                  processing: true,
                  log: 'Working on import....'
                });

                _context2.next = 4;
                return _jsreportStudio2.default.api.post('api/import', {
                  params: {
                    fullImport: this.state.fullImport,
                    targetFolder: this.state.selectedFolderShortid
                  },
                  attach: { filename: 'import.zip', file: this.file }
                }, true);

              case 4:
                result = _context2.sent;


                _jsreportStudio2.default.openModal(ImportFinishedModal, {
                  log: result.log
                });
                _context2.next = 11;
                break;

              case 8:
                _context2.prev = 8;
                _context2.t0 = _context2['catch'](0);

                this.setState({
                  status: '1',
                  processing: false,
                  log: _context2.t0.message + ' ' + _context2.t0.stack
                });

              case 11:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this, [[0, 8]]);
      }));

      function _import() {
        return _ref2.apply(this, arguments);
      }

      return _import;
    }()
  }, {
    key: 'cancel',
    value: function cancel() {
      this.setState({
        validated: false
      });
    }
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
      var _this6 = this;

      return _react2.default.createElement(
        'div',
        null,
        _react2.default.createElement('input', { type: 'file', key: 'file', ref: 'file', style: { display: 'none' }, onChange: function onChange(e) {
            return _this6.upload(e);
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
            'A ',
            _react2.default.createElement(
              'b',
              null,
              'validation is run first'
            ),
            ', so you can safely upload the exported package and review the changes which will be performed. Afterwards ',
            _react2.default.createElement(
              'b',
              null,
              'you can confirm or cancel the import'
            ),
            '.'
          )
        ),
        _react2.default.createElement(
          'div',
          { className: 'form-group' },
          _react2.default.createElement(
            'div',
            null,
            _react2.default.createElement(
              'label',
              { style: { opacity: this.state.processing === true || this.state.validated ? 0.7 : 1 } },
              _react2.default.createElement('input', {
                type: 'checkbox',
                style: { verticalAlign: 'middle' },
                disabled: this.state.processing === true || this.state.validated,
                onChange: function onChange(e) {
                  _this6.setState({
                    fullImport: e.target.checked
                  });
                }
              }),
              _react2.default.createElement(
                'span',
                { style: { verticalAlign: 'middle' } },
                'Full Import'
              )
            )
          ),
          this.state.fullImport && _react2.default.createElement(
            'p',
            { style: { marginTop: '15px' } },
            'A ',
            _react2.default.createElement(
              'b',
              null,
              'full import'
            ),
            ' means that ',
            _react2.default.createElement(
              'b',
              null,
              'all the entities that are not present in the zip will be deleted'
            ),
            ', after the import ',
            _react2.default.createElement(
              'b',
              null,
              'you will have only the entities that were present in the zip'
            ),
            '.'
          )
        ),
        _react2.default.createElement(
          'div',
          { className: 'form-group' },
          _react2.default.createElement(
            'div',
            { style: {
                display: !this.state.fullImport ? 'block' : 'none',
                border: '1px dashed black',
                padding: '0.6rem',
                opacity: this.state.processing === true || this.state.validated ? 0.7 : 1
              } },
            _react2.default.createElement(
              'label',
              null,
              'You can ',
              _react2.default.createElement(
                'b',
                null,
                'optionally'
              ),
              ' select a folder in which the entities  will be inserted'
            ),
            _react2.default.createElement(EntityRefSelect, {
              noModal: true,
              allowNewFolder: true,
              treeStyle: { height: '12rem' },
              headingLabel: 'Select folder',
              filter: function filter(references) {
                return { folders: references.folders };
              },
              selectableFilter: function selectableFilter(isGroup, entity) {
                return entity.__entitySet === 'folders';
              },
              value: this.state.selectedFolderShortid,
              disabled: this.state.processing === true || this.state.validated,
              onChange: function onChange(selected) {
                _this6.setState({
                  selectedFolderShortid: selected.length > 0 ? selected[0].shortid : null
                });
              }
            })
          ),
          !this.state.validated && _react2.default.createElement(
            'div',
            { className: 'button-bar' },
            _react2.default.createElement(
              'a',
              { className: 'button confirmation', onClick: function onClick() {
                  return _this6.openFileDialog();
                } },
              'Validate'
            )
          ),
          _react2.default.createElement('br', null),
          this.state.validated && _react2.default.createElement(
            'div',
            null,
            _react2.default.createElement(
              'div',
              null,
              _react2.default.createElement(
                'i',
                null,
                'Log of changes with the import:'
              )
            ),
            _react2.default.createElement('textarea', { style: { width: '100%', boxSizing: 'border-box' }, rows: '10', readOnly: true, value: this.state.log })
          ),
          this.state.validated && this.state.status === '0' && _react2.default.createElement(
            'div',
            { className: 'button-bar' },
            _react2.default.createElement(
              'a',
              { className: 'button danger', onClick: function onClick() {
                  return _this6.cancel();
                } },
              'Cancel'
            ),
            _react2.default.createElement(
              'a',
              { className: 'button confirmation', onClick: function onClick() {
                  return _this6.import();
                } },
              'Import'
            )
          )
        )
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

/***/ })
/******/ ]);