# Third-Party Notices

The MIT License in [LICENSE](LICENSE) applies to original Trace ML code and
authored course material. Third-party libraries, tools, and bundled runtime
components remain under their upstream licenses.

## Selected Bundled Runtime Components

| Component | Version | License | Source |
| --- | --- | --- | --- |
| Tauri core | 2.11.5 | Apache-2.0 OR MIT | [tauri-apps/tauri](https://github.com/tauri-apps/tauri) |
| Tauri JavaScript API | 2.11.1 | Apache-2.0 OR MIT | [tauri-apps/tauri](https://github.com/tauri-apps/tauri) |
| Tauri opener plugin | 2.5.4 | MIT OR Apache-2.0 | [tauri-apps/plugins-workspace](https://github.com/tauri-apps/plugins-workspace) |
| React and React DOM | 19.2.8 | MIT | [facebook/react](https://github.com/facebook/react) |
| Scheduler | 0.27.0 | MIT | [facebook/react](https://github.com/facebook/react) |
| Lucide React | 1.28.0 | ISC | [lucide-icons/lucide](https://github.com/lucide-icons/lucide) |
| Pyodide | 314.0.3 | MPL-2.0 | [pyodide/pyodide at `ac57031`](https://github.com/pyodide/pyodide/tree/ac57031be7564f864d061cb37c5c152e59f83ad4) |
| CPython runtime and standard library | 3.14.2 | Python-2.0 | [python/cpython](https://github.com/python/cpython/tree/v3.14.2) |
| NumPy | 2.4.3 | BSD-3-Clause | [numpy/numpy](https://github.com/numpy/numpy) |
| SciPy | 1.18.0 | BSD-3-Clause | [scipy/scipy](https://github.com/scipy/scipy) |
| scikit-learn | 1.8.0 | BSD-3-Clause | [scikit-learn/scikit-learn](https://github.com/scikit-learn/scikit-learn) |
| joblib | 1.5.3 | BSD-3-Clause | [joblib/joblib](https://github.com/joblib/joblib) |
| threadpoolctl | 3.6.0 | BSD-3-Clause | [joblib/threadpoolctl](https://github.com/joblib/threadpoolctl) |
| Autograd | 1.9.1 | MIT | [HIPS/autograd](https://github.com/HIPS/autograd) |

The scientific Python wheels are distributed unchanged and retain their
upstream license files inside each wheel archive. Pyodide and CPython source
code is available from the exact upstream links above. The
[Mozilla Public License 2.0](https://www.mozilla.org/MPL/2.0/) and
[Python Software Foundation License](https://docs.python.org/3/license.html)
apply to those components respectively.

## Complete Dependency Graph

JavaScript package versions, integrity digests, and declared licenses are
recorded in `package-lock.json`. Rust crate versions and checksums are recorded
in `src-tauri/Cargo.lock`. Build and test dependencies are not relicensed by
Trace ML.

This inventory supports local source builds; it is not a complete binary
redistribution notice. Before publishing a desktop binary, generate and bundle
the full license texts and required copyright notices for the exact JavaScript,
Rust, Python, and WebAssembly artifacts in that release.
