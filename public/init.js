// @ts-nocheck

const SELF_PROFILING_STORAGE_KEY = 'luker.selfProfilingEnabled';
const SELF_PROFILING_SAMPLE_INTERVAL = 10;
const SELF_PROFILING_MAX_BUFFER_SIZE = 50000;
const SELF_PROFILING_STATE_KEY = '__lukerSelfProfilerState';
const LORESTAGE_BUILD_ID = '20260528-import-filter';

function getStartupState() {
    try {
        const state = globalThis.__lorestageStartup = globalThis.__lorestageStartup || {};
        state.build = state.build || LORESTAGE_BUILD_ID;
        return state;
    } catch {
        return {};
    }
}

function setStartupStage(stage) {
    try {
        const state = getStartupState();
        state.stage = stage;
        state.updatedAt = new Date().toISOString();
        globalThis.__lorestageSetStartupStage?.(stage);
    } catch {
        // Ignore startup diagnostic failures.
    }
}

function getStartupErrorMessage(error) {
    if (error instanceof Error) {
        return error.message || error.name || 'Unknown startup error';
    }

    return String(error || 'Unknown startup error');
}

function showStartupFailure(error, stage) {
    const message = getStartupErrorMessage(error);

    try {
        const state = getStartupState();
        state.stage = stage || state.stage || 'entry-import';
        state.lastError = message.slice(0, 600);
        state.failed = true;
    } catch {
        // Ignore startup diagnostic failures.
    }

    if (typeof globalThis.__lorestageShowStartupFailure === 'function') {
        globalThis.__lorestageShowStartupFailure(stage || 'entry-import');
        return;
    }

    const preloader = document.getElementById('preloader');
    if (!preloader) {
        return;
    }

    preloader.textContent = '';
    Object.assign(preloader.style, {
        alignItems: 'center',
        background: '#151516',
        boxSizing: 'border-box',
        color: '#f4f4f5',
        display: 'flex',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        inset: '0',
        justifyContent: 'center',
        padding: '24px',
        position: 'fixed',
        zIndex: '999999',
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
        background: '#242426',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        borderRadius: '8px',
        maxWidth: '460px',
        padding: '22px',
        width: '100%',
    });

    const title = document.createElement('h1');
    title.textContent = 'Lorestage failed to load';
    title.style.cssText = 'font-size:20px;line-height:1.3;margin:0 0 10px;';
    const detail = document.createElement('p');
    detail.textContent = `Stage: ${stage || 'entry-import'} | Error: ${message}`;
    detail.style.cssText = 'color:#f0c7c7;font-size:12px;line-height:1.45;margin:0 0 16px;word-break:break-word;';
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.textContent = 'Reload';
    reload.style.cssText = 'border:1px solid rgba(255,255,255,.3);border-radius:6px;background:#fff;color:#111;cursor:pointer;font:600 14px system-ui;padding:10px 14px;';
    reload.addEventListener('click', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('reload', String(Date.now()));
        window.location.assign(url.toString());
    });

    panel.append(title, detail, reload);
    preloader.appendChild(panel);
}

function startSelfProfilerAtEarliestPoint() {
    try {
        /** @type {any} */
        const globalAny = globalThis;

        if (localStorage.getItem(SELF_PROFILING_STORAGE_KEY) !== '1') {
            return;
        }

        const ProfilerCtor = globalAny.Profiler;
        if (typeof ProfilerCtor !== 'function') {
            return;
        }

        const profiler = new ProfilerCtor({
            sampleInterval: SELF_PROFILING_SAMPLE_INTERVAL,
            maxBufferSize: SELF_PROFILING_MAX_BUFFER_SIZE,
        });

        globalAny[SELF_PROFILING_STATE_KEY] = {
            profiler,
            sampleInterval: SELF_PROFILING_SAMPLE_INTERVAL,
            maxBufferSize: SELF_PROFILING_MAX_BUFFER_SIZE,
            bufferFull: false,
            startedAt: performance.now(),
            startedAtIso: new Date().toISOString(),
        };

        profiler.addEventListener('samplebufferfull', () => {
            const state = globalAny[SELF_PROFILING_STATE_KEY];
            if (state && typeof state === 'object') {
                state.bufferFull = true;
            }
        });
    } catch {
        // Ignore errors during earliest bootstrap path.
    }
}

startSelfProfilerAtEarliestPoint();

const PERF_ENABLED = (() => {
    try {
        const search = String(globalThis.location?.search || '');
        if (!search) {
            return false;
        }

        const params = new URLSearchParams(search);
        return params.get('lukerPerf') === '1' || params.get('luker_perf') === '1';
    } catch {
        return false;
    }
})();

/** @param {string} name */
function safePerfMark(name) {
    if (!PERF_ENABLED) {
        return;
    }

    try {
        performance?.mark?.(name);
    } catch {
        // Ignore unsupported mark calls.
    }
}

/** @param {string} name @param {string} startMark @param {string} endMark */
function safePerfMeasure(name, startMark, endMark) {
    if (!PERF_ENABLED) {
        return;
    }

    try {
        performance?.measure?.(name, startMark, endMark);
    } catch {
        // Ignore unsupported measure calls.
    }
}

async function initializeApplication() {
    setStartupStage('entry:start');
    safePerfMark('luker:init:start');

    try {
        setStartupStage('entry:import-lib');
        safePerfMark('luker:init:import:lib:start');
        await import('./lib.js');
        safePerfMark('luker:init:import:lib:end');
        safePerfMeasure('luker:init:import:lib', 'luker:init:import:lib:start', 'luker:init:import:lib:end');

        setStartupStage('entry:import-app');
        safePerfMark('luker:init:import:app:start');
        await import('./script.js');
        safePerfMark('luker:init:import:app:end');
        safePerfMeasure('luker:init:import:app', 'luker:init:import:app:start', 'luker:init:import:app:end');

        setStartupStage('entry:import-complete');
    } catch (error) {
        console.error('Failed to initialize Luker application:', error);
        showStartupFailure(error, 'entry-import');
    } finally {
        safePerfMark('luker:init:end');
        safePerfMeasure('luker:init:total', 'luker:init:start', 'luker:init:end');
    }
}

initializeApplication();
