"""Add synchronous progress to test copies in a scratch mirror.

Run with the scratch directory as cwd after copying tests/ to trace-tests/.
No production module or numerical test expectation is changed.
"""
from pathlib import Path
for file in Path("trace-tests").glob("*.test.mjs"):
    source = file.read_text()
    declaration = next(line for line in source.splitlines()
                       if "from " in line and "node:test" in line)
    source = source.replace(declaration, f'''import register from "node:test";
import {{ appendFileSync }} from "node:fs";
const trace = (phase, name) => appendFileSync(process.env.AIRFLOW_TEST_TRACE, `${{Date.now()}} ${{phase}} {file.name} ${{name}}\n`);
const test = (name, ...args) => {{
  const callback = args.pop();
  register(name, ...args, (ctx) => {{
    trace("begin", name);
    try {{ return callback(ctx); }} finally {{ trace("end", name); }}
  }});
}};''', 1)
    if file.name == "vlmOracles.test.mjs":
        # On the second instrumented pass, narrow the stuck VLM-V2 callback
        # to individual matchCl solver calls without instrumenting a hot loop.
        original = "    last = wingCase({ ...params, alphaDeg: mid });"
        source = source.replace(original, '''    const label = `matchCl ${params.m}x${params.n} i=${iteration} alpha=${mid}`;
    trace("solve begin", label);
    last = wingCase({ ...params, alphaDeg: mid });
    trace("solve end", label);''')
    file.write_text(source)
