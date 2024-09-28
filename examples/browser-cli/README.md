# browser-cli

```sh
# use CLI_HEADED=1 to show browser window
$ pnpm cli
> window.navigator.userAgent
Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/127.0.6533.17 Safari/537.36
> (await import("react-dom/client")).createRoot(document.body).render(<div>yay</div>);
undefined
> document.body.innerHTML
<div>yay</div>
```

## credits

- https://github.com/webdriverio/bx
