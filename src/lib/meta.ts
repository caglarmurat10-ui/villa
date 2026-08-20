2026-08-20T16:49:22.915Z	Initializing build environment...
2026-08-20T16:50:21.388Z	Success: Finished initializing build environment
2026-08-20T16:50:23.418Z	Cloning repository...
2026-08-20T16:50:27.772Z	Restoring from dependencies cache
2026-08-20T16:50:27.774Z	Restoring from build output cache
2026-08-20T16:50:27.778Z	Detected the following tools from environment: npm@10.9.2, nodejs@24.18.0
2026-08-20T16:50:35.404Z	Success: Build output restored from build cache.
2026-08-20T16:50:35.966Z	Success: Dependencies restored from build cache.
2026-08-20T16:50:35.968Z	Installing project dependencies: npm clean-install --progress=false
2026-08-20T16:50:46.077Z	npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
2026-08-20T16:50:46.906Z	npm warn deprecated glob@9.3.5: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
2026-08-20T16:50:57.872Z	
2026-08-20T16:50:57.873Z	added 635 packages, and audited 636 packages in 20s
2026-08-20T16:50:57.873Z	
2026-08-20T16:50:57.873Z	198 packages are looking for funding
2026-08-20T16:50:57.873Z	  run `npm fund` for details
2026-08-20T16:50:57.874Z	
2026-08-20T16:50:57.874Z	found 0 vulnerabilities
2026-08-20T16:50:57.875Z	npm warn allow-scripts 4 packages have install scripts not yet covered by allowScripts:
2026-08-20T16:50:57.875Z	npm warn allow-scripts   esbuild@0.25.4 (postinstall: node install.js)
2026-08-20T16:50:57.878Z	npm warn allow-scripts   unrs-resolver@1.12.2 (postinstall: node postinstall.js)
2026-08-20T16:50:57.878Z	npm warn allow-scripts   workerd@1.20260815.1 (postinstall: node install.js)
2026-08-20T16:50:57.879Z	npm warn allow-scripts   esbuild@0.28.1 (postinstall: node install.js)
2026-08-20T16:50:57.879Z	npm warn allow-scripts
2026-08-20T16:50:57.879Z	npm warn allow-scripts Run `npm approve-scripts --allow-scripts-pending` to review, or `npm approve-scripts <pkg>` to allow.
2026-08-20T16:50:58.310Z	Executing user build command: npm run build
2026-08-20T16:50:58.669Z	
2026-08-20T16:50:58.669Z	> villa-yonetim@0.1.0 build
2026-08-20T16:50:58.669Z	> next build
2026-08-20T16:50:58.669Z	
2026-08-20T16:50:59.039Z	▲ Next.js 16.3.1 (Turbopack)
2026-08-20T16:51:00.403Z	✓ Running next.config.ts took 1363ms
2026-08-20T16:51:00.472Z	
2026-08-20T16:51:00.563Z	  Creating an optimized production build ...
2026-08-20T16:51:02.151Z	
2026-08-20T16:51:02.151Z	> Build error occurred
2026-08-20T16:51:02.154Z	Error: Turbopack build failed with 1 error:
2026-08-20T16:51:02.155Z	./src/lib/meta.ts:33:1
2026-08-20T16:51:02.155Z	Error: 'import', and 'export' cannot be used outside of module code
2026-08-20T16:51:02.155Z	  31 |   };
2026-08-20T16:51:02.155Z	  32 |   
2026-08-20T16:51:02.155Z	> 33 | export async function makeInstagramState(villa: Villa, nonce: string) {
2026-08-20T16:51:02.155Z	     | ^^^^^^
2026-08-20T16:51:02.155Z	  34 |   const { appSecret } = await metaConfig();
2026-08-20T16:51:02.155Z	  35 |
2026-08-20T16:51:02.155Z	  36 |   const payload = `${villa}.${nonce}`;
2026-08-20T16:51:02.155Z	
2026-08-20T16:51:02.155Z	Parsing ecmascript source code failed
2026-08-20T16:51:02.155Z	
2026-08-20T16:51:02.155Z	Import trace:
2026-08-20T16:51:02.155Z	  App Route:
2026-08-20T16:51:02.155Z	    ./src/lib/meta.ts
2026-08-20T16:51:02.155Z	    ./src/app/api/meta/instagram/publish/route.ts
2026-08-20T16:51:02.155Z	
2026-08-20T16:51:02.155Z	
2026-08-20T16:51:02.155Z	    at <unknown> (./src/lib/meta.ts:33:1)
2026-08-20T16:51:02.242Z	Failed: error occurred while running build command
