require('esbuild').serve({
    servedir: './www',
}, {
    entryPoints: ['src/index.ts'],
    outdir: './www/js',
    bundle: true,
}).then(server => {
    // Call "stop" on the web server to stop serving
    // server.stop()
    console.log(`服务已开启http://${server.host}:${server.port}`);
})