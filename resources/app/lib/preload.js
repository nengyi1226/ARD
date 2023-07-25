"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.INJECT_DIR = void 0;
/**
 * Preload file that will be executed in the renderer process.
 * Note: This needs to be attached **prior to imports**, as imports
 * would delay the attachment till after the event has been raised.
 */
document.addEventListener('DOMContentLoaded', () => {
    injectScripts(); // eslint-disable-line @typescript-eslint/no-use-before-define
});
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
// Do *NOT* add 3rd-party imports here in preload (except for webpack `externals` like electron).
// They will work during development, but break in the prod build :-/ .
// Electron doc isn't explicit about that, so maybe *we*'re doing something wrong.
// At any rate, that's what we have now. If you want an import here, go ahead, but
// verify that apps built with a non-devbuild nativefier (installed from tarball) work.
// Recipe to monkey around this, assuming you git-cloned nativefier in /opt/nativefier/ :
// cd /opt/nativefier/ && rm -f nativefier-43.1.0.tgz && npm run build && npm pack && mkdir -p ~/n4310/ && cd ~/n4310/ \
//    && rm -rf ./* && npm i /opt/nativefier/nativefier-43.1.0.tgz && ./node_modules/.bin/nativefier 'google.com'
// See https://github.com/nativefier/nativefier/issues/1175
// and https://www.electronjs.org/docs/api/browser-window#new-browserwindowoptions / preload
const log = console; // since we can't have `loglevel` here in preload
exports.INJECT_DIR = path.join(__dirname, '..', 'inject');
/**
 * Patches window.Notification to:
 * - set a callback on a new Notification
 * - set a callback for clicks on notifications
 * @param createCallback
 * @param clickCallback
 */
function setNotificationCallback(createCallback, clickCallback) {
    const OldNotify = window.Notification;
    const newNotify = function (title, opt) {
        createCallback(title, opt);
        const instance = new OldNotify(title, opt);
        instance.addEventListener('click', clickCallback);
        return instance;
    };
    newNotify.requestPermission = OldNotify.requestPermission.bind(OldNotify);
    Object.defineProperty(newNotify, 'permission', {
        get: () => OldNotify.permission,
    });
    // @ts-expect-error TypeScript says its not compatible, but it works?
    window.Notification = newNotify;
}
async function getDisplayMedia(sourceId) {
    var _a;
    if (!((_a = window === null || window === void 0 ? void 0 : window.navigator) === null || _a === void 0 ? void 0 : _a.mediaDevices)) {
        throw Error('window.navigator.mediaDevices is not present');
    }
    // Electron supports an outdated specification for mediaDevices,
    // see https://www.electronjs.org/docs/latest/api/desktop-capturer/
    const stream = await window.navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sourceId,
            },
        },
    });
    return stream;
}
function setupScreenSharePickerStyles(id) {
    const screenShareStyles = document.createElement('style');
    screenShareStyles.id = id;
    screenShareStyles.innerHTML = `
  .desktop-capturer-selection {
    --overlay-color: hsla(0, 0%, 11.8%, 0.75);
    --highlight-color: highlight;
    --text-content-color: #fff;
    --selection-button-color: hsl(180, 1.3%, 14.7%);
  }
  .desktop-capturer-selection {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    background: var(--overlay-color);
    color: var(--text-content-color);
    z-index: 10000000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .desktop-capturer-selection__close {
    -moz-appearance: none;
    -webkit-appearance: none;
    appearance: none;
    padding: 1rem;
    color: inherit;
    position: absolute;
    left: 1rem;
    top: 1rem;
    cursor: pointer;
  }
  .desktop-capturer-selection__scroller {
    width: 100%;
    max-height: 100vh;
    overflow-y: auto;
  }
  .desktop-capturer-selection__list {
    max-width: calc(100% - 100px);
    margin: 50px;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    list-style: none;
    overflow: hidden;
    justify-content: center;
  }
  .desktop-capturer-selection__item {
    display: flex;
    margin: 4px;
  }
  .desktop-capturer-selection__btn {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 145px;
    margin: 0;
    border: 0;
    border-radius: 3px;
    padding: 4px;
    background: var(--selection-button-color);
    text-align: left;
    transition: background-color .15s, box-shadow .15s;
  }
  .desktop-capturer-selection__btn:hover,
  .desktop-capturer-selection__btn:focus {
    background: var(--highlight-color);
  }
  .desktop-capturer-selection__thumbnail {
    width: 100%;
    height: 81px;
    object-fit: cover;
  }
  .desktop-capturer-selection__name {
    margin: 6px 0 6px;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }
  @media (prefers-color-scheme: light) {
    .desktop-capturer-selection {
      --overlay-color: hsla(0, 0%, 90.2%, 0.75);
      --text-content-color: hsl(0, 0%, 12.9%);
      --selection-button-color: hsl(180, 1.3%, 85.3%);
    }
  }`;
    document.head.appendChild(screenShareStyles);
}
function setupScreenSharePickerElement(id, sources) {
    const selectionElem = document.createElement('div');
    selectionElem.classList.add('desktop-capturer-selection');
    selectionElem.id = id;
    selectionElem.innerHTML = `
    <button class="desktop-capturer-selection__close" id="${id}-close" aria-label="Close screen share picker" type="button">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
      <path fill="currentColor" d="m12 10.586 4.95-4.95 1.414 1.414-4.95 4.95 4.95 4.95-1.414 1.414-4.95-4.95-4.95 4.95-1.414-1.414 4.95-4.95-4.95-4.95L7.05 5.636z"/>   
      </svg>
    </button>
    <div class="desktop-capturer-selection__scroller">
      <ul class="desktop-capturer-selection__list">
        ${sources
        .map(({ id, name, thumbnail }) => `
          <li class="desktop-capturer-selection__item">
            <button class="desktop-capturer-selection__btn" data-id="${id}" title="${name}">
              <img class="desktop-capturer-selection__thumbnail" src="${thumbnail.toDataURL()}" />
              <span class="desktop-capturer-selection__name">${name}</span>
            </button>
          </li>
        `)
        .join('')}
      </ul>
    </div>
    `;
    document.body.appendChild(selectionElem);
}
function setupScreenSharePicker(resolve, reject, sources) {
    var _a;
    const baseElementsId = 'native-screen-share-picker';
    const pickerStylesElementId = baseElementsId + '-styles';
    setupScreenSharePickerElement(baseElementsId, sources);
    setupScreenSharePickerStyles(pickerStylesElementId);
    const clearElements = () => {
        var _a, _b;
        (_a = document.getElementById(pickerStylesElementId)) === null || _a === void 0 ? void 0 : _a.remove();
        (_b = document.getElementById(baseElementsId)) === null || _b === void 0 ? void 0 : _b.remove();
    };
    (_a = document
        .getElementById(`${baseElementsId}-close`)) === null || _a === void 0 ? void 0 : _a.addEventListener('click', () => {
        clearElements();
        reject('Screen share was cancelled by the user.');
    });
    document
        .querySelectorAll('.desktop-capturer-selection__btn')
        .forEach((button) => {
        button.addEventListener('click', () => {
            const id = button.getAttribute('data-id');
            if (!id) {
                log.error("Couldn't find `data-id` of element");
                clearElements();
                return;
            }
            const source = sources.find((source) => source.id === id);
            if (!source) {
                log.error(`Source with id "${id}" does not exist`);
                clearElements();
                return;
            }
            getDisplayMedia(source.id)
                .then((stream) => {
                resolve(stream);
            })
                .catch((err) => {
                log.error('Error selecting desktop capture source:', err);
                reject(err);
            })
                .finally(() => {
                clearElements();
            });
        });
    });
}
function setDisplayMediaPromise() {
    var _a;
    // Since no implementation for `getDisplayMedia` exists in Electron we write our own.
    if (!((_a = window === null || window === void 0 ? void 0 : window.navigator) === null || _a === void 0 ? void 0 : _a.mediaDevices)) {
        return;
    }
    window.navigator.mediaDevices.getDisplayMedia = () => {
        return new Promise((resolve, reject) => {
            const sources = electron_1.ipcRenderer.invoke('desktop-capturer-get-sources');
            sources
                .then(async (sources) => {
                if (isWayland()) {
                    // No documentation is provided wether the first element is always PipeWire-picked or not
                    // i.e. maybe it's not deterministic, we are only taking a guess here.
                    const stream = await getDisplayMedia(sources[0].id);
                    resolve(stream);
                }
                else {
                    setupScreenSharePicker(resolve, reject, sources);
                }
            })
                .catch((err) => {
                reject(err);
            });
        });
    };
}
function injectScripts() {
    const needToInject = fs.existsSync(exports.INJECT_DIR);
    if (!needToInject) {
        return;
    }
    // Dynamically require scripts
    try {
        const jsFiles = fs
            .readdirSync(exports.INJECT_DIR, { withFileTypes: true })
            .filter((injectFile) => injectFile.isFile() && injectFile.name.endsWith('.js'))
            .map((jsFileStat) => path.join('..', 'inject', jsFileStat.name));
        for (const jsFile of jsFiles) {
            log.debug('Injecting JS file', jsFile);
            require(jsFile);
        }
    }
    catch (err) {
        log.error('Error encoutered injecting JS files', err);
    }
}
function notifyNotificationCreate(title, opt) {
    electron_1.ipcRenderer.send('notification', title, opt);
}
function notifyNotificationClick() {
    electron_1.ipcRenderer.send('notification-click');
}
// @ts-expect-error TypeScript thinks these are incompatible but they aren't
setNotificationCallback(notifyNotificationCreate, notifyNotificationClick);
setDisplayMediaPromise();
electron_1.ipcRenderer.on('params', (event, message) => {
    log.debug('ipcRenderer.params', { event, message });
    const appArgs = JSON.parse(message);
    log.info('nativefier.json', appArgs);
});
electron_1.ipcRenderer.on('debug', (event, message) => {
    log.debug('ipcRenderer.debug', { event, message });
});
// Copy-pastaed as unable to get imports to work in preload.
// If modifying, update also app/src/helpers/helpers.ts
function isWayland() {
    return (isLinux() &&
        (Boolean(process.env.WAYLAND_DISPLAY) ||
            process.env.XDG_SESSION_TYPE === 'wayland'));
}
function isLinux() {
    return os.platform() === 'linux';
}
//# sourceMappingURL=preload.js.map