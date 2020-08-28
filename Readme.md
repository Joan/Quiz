# Quiz

A web based movies music and images riddles with buzzers
v2.4.1

## Installation

**Requirements**:

* Node.js
* The main computer LAN accessible if different devices needed
* Modern browser

### Node project

```
cd /path/to/project/
npm install
```

### Setup

#### Quiz data

* The riddles files are in **`media/videos`** / **`media/audios`** / **`media/images`**.  
Ideally, export videos as *MP4*, audio files as *MP3* and images as ~*MP2*~ *JPEG* (depending on the browser you'll use, but these filetypes are supported by all major browser at this time).

* The riddles data is in **`media/_data/quiz.json`**.  
Edit it directly or use a spreadsheet JSON export like [this one](https://docs.google.com/spreadsheets/d/1YWFbp7LhCN80PGrgEitF8buVr_Qry4TLkCbMWhnybxA/edit).
  * `type`: `video` / `audio` / `image`
  * `filename`: riddle file (without the path, just the filename)
  * `filename_answer`: for images only, the same image with the answer – like a movie poster with and without the name (optional)
  * `answer` and `answer_subtitle`: displayed in the admin panel

* A poster image can be displayed before the first riddle, by adding a PNG image at **`media/intro-poster.png`**. <kbd>Enter</kbd> to hide it and load the first riddle.

#### Teams

* Edit teams `name`, displayed `color` (hexa: `#000000`) and `keycode` ([keycode.info](https://keycode.info/) might be useful here) in **`media/_data/teams.json`**. `keycode_name` can be used as a comment to remember the assigned key (not displayed anywhere).
* The last file **`media/_data/scores.json`** doesn’t need to be edited (scores are manageable in the admin panel).

### Buzzers

If you want to use external buzzers, you may map these to the teams keycodes.

For the Xbox Big Buttons, under Linux (as a VM with `/receiver` for example):
* Install https://github.com/micolous/xbox360bb to enable receiver, and activate it with `sudo modprobe -v xbox360bb`
* Install https://github.com/AntiMicro/antimicro and set it up to map these controllers to your teams keys

## Usage

### Screens

Launch the project with
```
node server.js
```
It displays your local IP and URLs for the different screens (replace *localhost* below with your local IP if needed)

* **Player** – http://localhost:8080/player  
Displayed in front of the players, and receives keyboard events so need to be focused on.

* **Admin** – http://localhost:8080/admin  
Displayed on a separate device – triggers player shortcuts to `/player`.

* **Buzzers signal reception** – http://localhost:8080/receiver  
Receives buzzers signal on a different device – triggers buzzers keycode to `/player`.

* **Digital buzzer buttons** – http://localhost:8080/buzzers (redirected to from `/`)  
To be used on any device as replacement of hardware buzzers.  
Leads to `/buzzers/[team_id]` (`[team_id]` is the team object position in teams.json)

### Player controls

* <kbd>Space</kbd> : play / pause / remove current buzzer from queue
* <kbd>Enter</kbd> : go to next riddle
* <kbd>←</kbd> / <kbd>→</kbd> : go to previous / next riddle immediatly and play
* <kbd>Esc</kbd> : remove all buzzers from queue
* <kbd>A</kbd> : reveal answer image (if available)
* <kbd>S</kbd> : toggle scoreboard (scoreboard is displayed immediatly when you change scores from the admin panel)
* <kbd>H</kbd> : toggle QR Code for digital buzzer access
