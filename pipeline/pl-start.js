'use strict';
/* pl-start.js · YatraLine · starts the app once every route is registered (keep last).
   One of the YatraLine files loaded by nex.html (list and order: PL_FILES in the loader). All of them share one global scope. */
/* start only after every route is registered */
if (ss.get('ngate_nex') === '1') boot(); else window.addEventListener('nex-unlocked', boot, { once: true });
