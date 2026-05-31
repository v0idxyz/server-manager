# Server Manager

A desktop (Electron) app to keep track of your servers: what each one is, what it does,
how they connect to each other, and their login credentials — with a one-click "reveal & copy"
for passwords.

## Features
- **Visual map** — every server is a draggable card on a canvas. Drag to arrange.
- **Connect servers** — click **🔗 Connect**, click a source then a target, and (optionally) label the link.
- **Details panel** — click any server to see its role, host, username, tags, notes, and connections.
- **Password reveal & copy** — passwords are hidden by default; click 👁 to reveal, **⧉ Copy** to copy.
- **Add / Edit / Delete** servers, each with a color.
- **Search** the whole inventory from the top bar.
- **Export / Import** a JSON backup via native file dialogs.

## Running it
Double-click **`Start Server Manager.bat`**, or from a terminal in this folder:

```
npm start
```

## Where your data lives
Everything is saved to a JSON file in your Windows user AppData folder:

```
%APPDATA%\Server Manager\data.json
```

To back it up, use **⭳ Export** (or just copy that file).

## Building a standalone installer (optional)
To produce a Windows installer (`.exe`) you can run without a terminal:

```
npm run dist
```

The installer is written to the `dist\` folder.

## ⚠ Security note
Passwords are stored **unencrypted** in the data file, and exports are plaintext.
Use this only on a trusted, private machine. (We can add a master-password or
Windows-login encryption layer later if you want.)
