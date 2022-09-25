# Quiz

A LAN web based video, music and images riddle app with buzzers

## Screenshots

### Main screen
Scoreboard and buzz queue (media is blurred when paused)

<img width="600" alt="" src="https://user-images.githubusercontent.com/471627/91641124-acf8de00-ea22-11ea-99b7-bce01f894213.png">

### Admin
Scores management, answers (and quick jump), shortcuts helper

<img width="600" alt="" src="https://user-images.githubusercontent.com/471627/91641130-aff3ce80-ea22-11ea-9c39-960c0db2a74d.png">

### Smartphone buzzers
Team selection, on-screen buzzers – for use instead of proper buzzer devices

<img width="250" alt="" src="https://user-images.githubusercontent.com/471627/91641131-b124fb80-ea22-11ea-8854-5ab7f398b026.png"> <img width="250" alt="" src="https://user-images.githubusercontent.com/471627/91641132-b2eebf00-ea22-11ea-8070-308492a35077.png"> <img width="250" alt="" src="https://user-images.githubusercontent.com/471627/91641134-b41fec00-ea22-11ea-9152-98a9abcc1b08.png">


## Installation

### Requirements

* [Node.js](https://nodejs.org/fr/download/)
* The device used as player has to be LAN accessible for multiple devices usage

### Node project

```
cd /path/to/project/
npm install
```

## Setup

### Quiz data

All the data of one game session is in the **`_data`** folder: riddles, teams and scores.  
You can store your game sessions by renaming it `_data-<whatever>` afterwards.  
Nb: the `_data-sample` folder is automatically copied to `_data` upon installation, and you can use it later to create a fresh `_data` for a new game.

* **Riddles** are in `_data/quiz.json`.  
Edit it directly or use [this spreadsheet](https://docs.google.com/spreadsheets/d/1gINMhwLp5sicssOqDFx4RDUT5UNfG8hwdR5GXiGQ-Q4/copy) to export as JSON.
  * `type`: `video` / `audio` / `image`
  * `filename`: riddle file (without the path, just the filename)
  * `filename_answer`: for images only, the same image with the answer – like a movie poster with and without the name (optional)
  * `answer` and `answer_subtitle`: displayed in the admin panel

* **Teams** can be edited directly in the Admin screen.
You can also edit them directly in `_data/teams.json`.
  * `name`: displayed team name
  * `color`: team color (hexa: `#000000`)
  * `keycode`: triggered keyboard key for this team. Each team has to have its own keycode, and it must not be an app shortcut. ([Keycode.info](https://keycode.info/) might be useful here.)
  * `keycode_name` is here as a comment to remember the assigned key (not used elsewhere)

* **Scores** are in `_data/scores.json` and it doesn’t need to be edited (scores are managed in the admin panel).

You can change the data directory path by passing the name you want at startup: `npm start -- data_dir=_data-game_session_836`

### Media files

All you media files go in **`_media/`**: `_media/videos`, `_media/audios` and `_media/images`.  
Use MP4 videos, MP3 audio files and ~MP2~ JPEG images to ensure your browser can read them (these filetypes are supported by all major browser at this time).

A **poster image** can be displayed before the first riddle, by adding a PNG image at `_media/intro-poster.png`.  
<kbd>Enter</kbd> to hide it and load the first riddle.

You can change the media directory path by passing the name you want at startup: `npm start -- data_dir=_data-game_session_836 media_dir=_media-game_session_836`

### Buzzers

If you want to use external buzzers, you may map these to the teams keycodes.

For the Xbox Big Buttons, under Linux (using the `/receiver` URL, and as a VM if needed):
* Install https://github.com/micolous/xbox360bb to enable receiver, and activate it with `sudo modprobe -v xbox360bb`
* Install https://github.com/AntiMicro/antimicro and set it up to map these controllers to your teams keys

## Usage

### Screens

Launch the project with
```
npm start
```
It displays URLs of all the different screens

* **Player** – `/player`  
Displayed in front of the players, and receives keyboard events so need to be focused on.

* **Admin** – `/admin`  
Displayed on a separate device – triggers player shortcuts & teams keycode to `/player`.  
You can change this route by passing the path you want at startup: `npm start -- admin_route=admin123`

* **Buzzers signal reception** – `/receiver`  
Receives buzzers signal on a different device – triggers buzzers keycode to `/player`.

* **Digital buzzer buttons** – `/buzzers` (`/` redirect there)  
To be used on any device as replacement of hardware buzzers.  
Leads to `/buzzers/<team_id>` (`<team_id>` is the team object position in teams.json)

### Player controls

* <kbd>Space</kbd> : play / pause / remove current buzzer from queue
* <kbd>Enter</kbd> : go to next riddle with normal transition
* <kbd>←</kbd> / <kbd>→</kbd> : go to previous / next riddle immediatly and play
* <kbd>Esc</kbd> : remove all buzzers from queue
* <kbd>A</kbd> : reveal answer image (if available)
* <kbd>S</kbd> : toggle scoreboard (scoreboard is displayed immediatly when you change scores from the admin panel)
* <kbd>Q</kbd> : toggle display of a QR Code on the player to access digital buzzers URL
* <kbd>B</kbd> : toggle buzzers activation

## Todo

- [ ] Touch screen friendly admin
- [ ] A better sound visualizer
- [ ] Scoreboard only mode
- [ ] Simple i18n
- [ ] Connection (online / offline) state indicator (for player, admin, buzzers)
