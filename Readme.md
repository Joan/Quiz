# Quiz

A LAN-based video, music and images riddle web app with buzzers

## Screenshots

### Main screen
Scoreboard and buzz queue (media is blurred when paused)

<img width="600" alt="" src="https://user-images.githubusercontent.com/471627/91641124-acf8de00-ea22-11ea-99b7-bce01f894213.png">

### Admin
Scores management, answers (and quick jump), control board

<img width="600" alt="" src="https://user-images.githubusercontent.com/471627/91641130-aff3ce80-ea22-11ea-9c39-960c0db2a74d.png">

### Smartphone Buzzers
Team selection, on-screen buzzers – for use instead of proper buzzer devices

<img width="250" alt="" src="https://user-images.githubusercontent.com/471627/91641131-b124fb80-ea22-11ea-8854-5ab7f398b026.png"> <img width="250" alt="" src="https://user-images.githubusercontent.com/471627/91641132-b2eebf00-ea22-11ea-8070-308492a35077.png"> <img width="250" alt="" src="https://user-images.githubusercontent.com/471627/91641134-b41fec00-ea22-11ea-9152-98a9abcc1b08.png">


## Installation

### Requirements

* [Node.js](https://nodejs.org/fr/download/)
* The device used as player has to be LAN accessible for multiple devices usage

### Install

```
cd /path/to/project/
npm install
```

## Setup

### Quiz data

All the data of one game session is in the **`data`** folder: riddles, teams and scores.  
Nb: the `data-sample` folder is automatically copied to `data` upon installation. You can use it later to create a fresh `data` for a new game.

* **Riddles** are in `data/quiz.json`.  
Edit it directly or use [this spreadsheet](https://docs.google.com/spreadsheets/d/1gINMhwLp5sicssOqDFx4RDUT5UNfG8hwdR5GXiGQ-Q4/copy) to paste in all JSON data.
  * `type`: `video` / `audio` / `image`
  * `filename`: riddle file (without the path, just the filename)
  * `filename_answer`: file to use as an answer – like a movie poster with and without the name, or a part of a music and another more famous (optional - filename and filename_answer must be the same type)
  * `answer` and `answer_subtitle`: displayed in the admin panel
You can use only the scoreboard & buzzers by emptying `data/quiz.json` (or by putting an empty array `[]`).

* **Teams** can be edited directly in the Admin screen.  
You can also edit them in `data/teams.json`.
  * `name`: displayed team name
  * `color`: team color (hexa: `#000000`)
  * `buzzer_name`: buzzer name/id from Buzzer Bridge
  * `buzzer_keycode`: buzzer keyboard shortcut for this team. Must not be an app shortcut. ([Keycode.info](https://keycode.info/) might be useful here.)
  * `buzzer_keycode_name` is here as a comment to remember the assigned key (not used in the app)

* **Scores** are in `data/scores.json` and it doesn’t need to be edited (scores are managed in the admin panel).

You can change the data folder name by passing the name you want at startup: `npm start -- data_dir=data-game_session_836` (or juste rename the `data` folder to `data-<whatever>` after the game if you want to store your game sessions).

### Media files

All your media files go in **`media/`**: `media/videos`, `media/audios` and `media/images`.  
Use MP4 videos, MP3 audio files and ~MP2~ JPEG images to ensure your browser can read them (these filetypes are supported by all major browser at this time).

A **poster image** can be displayed before the first riddle, by adding an image (PNG / JPEG) named `intro-poster.png` (or `.jpg`) in your data folder.  
<kbd>Enter</kbd> to hide it and load the first riddle.

You can change the media directory path by passing the name you want at startup: `npm start -- data_dir=data-game_session_836 media_dir=media-game_session_836`

If some of your media files are specific to a single game session and you do want them in the `media` folder, add a `_` to the beginning of their filename, and place them in a `temp_media` folder in you data folder.  
Every filename beggining with a `_` will be searched in this folder: `a.jpg` must be in `media/images/a.jpg`, and `_a.jpg` must be in `data/temp_media/images/_a.jpg` (or the name of your data folder).

### Buzzers

You can use **physical buzzers** by using [RPi Buzzers Bridge](https://github.com/Joan/RPi-Buzzers-Bridge) or any keyboard-mapped buzzers.

Alternatively, you can use included **virtual buzzers** by displaying a QR code for players to access a buzzer on their phone.  
If the players' phone are not on the same local network, you can use a tunnelling service (like Serveo.net) and display the external URL in the QR code (instead of local IP) by passing it at startup: `npm start -- buzzer_domain=abc123.serveo.net`.

## Usage

### Screens

Launch the project with
```
npm start
```
It displays URLs of all the different screens.  
You can change the port with `npm start -- port=8888` (default is 8080).

* **Player** – `/player`  
Displayed in front of the players, and receives keyboard events so need to be focused on.

* **Admin** – `/admin`  
Displayed on a separate device – triggers player shortcuts & teams keycode to `/player`.  
You can change this route by passing the path you want at startup: `npm start -- admin_route=admin123`.

* **Buzzers signal reception** – `/receiver`  
Receives buzzers signal on a different device – triggers buzzers keycode to `/player`.

* **Virtual buzzer buttons** – `/buzzers` (`/` redirect there)  
To be used on any device as replacement of hardware buzzers.  
Leads to `/buzzers/<team_id>` (`<team_id>` is the team object position in teams.json).

### Player keyboard shortcuts

Enabled in player and admin pages.

|  |  |
| - | - |
| <kbd>Space</kbd> | Play / pause / remove current buzzer from queue |
| <kbd>Enter</kbd> | Go to next riddle with normal transition |
| <kbd>←</kbd> / <kbd>→</kbd> | Go to previous / next riddle immediatly and play |
| <kbd>Esc</kbd> | Remove all buzzers from queue |
| <kbd>A</kbd> | Reveal answer (if available) |
| <kbd>S</kbd> | Toggle scoreboard (scoreboard is displayed immediatly when you change scores from the admin panel) |
| <kbd>Q</kbd> | Toggle display of the virtual buzzers QR Code and URL |
| <kbd>B</kbd> | Toggle buzzers activation |
| <kbd>F</kbd> | Toggle fullscreen |

## Todo

- [ ] Mobile admin: horizontal slide for teams and riddles?
