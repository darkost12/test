/**
 * Gets songs from AWS S3 through REST API and puts in the custom WEB-player. 
 */

var receivedNames = [];	//The information received from the API-call before shuffle.
var transitionalNames = [];//The information in the shuffle process.
var shuffledNames = [];	//The information after the shuffle process. Ready to be put in the actual play.
var currentSong;			//The global identificator of currently playing song
var playFlag;				//The Boolean flag of playing status.
var audiopl = document.getElementById('music_player');		//The link to the <audio> element in your HTML code.
var songName = document.getElementById('song_name');		//The link to the <p>/<h> element.
var toggleBut = document.getElementById('toggle_button');		//The link to the <img> element.
var volumeBut = document.getElementById('volume_button');		//The link to the <img> element.
var position = document.getElementById('current_position');	//The link to the <input type="range"> element.
var timing = document.getElementById('current_time');		//The link to the <div> element.
var audioContext, visualctx, audioSrc, analyser;			//Variables for audioContext analysis.
var canvas, dpr, capHeight;		//Canvas and bars variables.
window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext;	//Automatic detection of webkit.

/**
 * Shuffles music after getting through API call.
 */
function shuffleMusic() {
	songName.style.display = 'none';
	audiopl.currentTime = 0;
	playFlag = false;
	audiopl.pause();
	toggleBut.src = "res/play.png";
	let ctr = receivedNames.length;	//Fisher-Yates shuffle algorithm
	let index, temp;
	transitionalNames = receivedNames;
	while (ctr>0) {
		index = Math.floor(Math.random() * ctr);
		ctr--;
		temp = transitionalNames[ctr];
		transitionalNames[ctr] = transitionalNames[index];
		transitionalNames[index] = temp;	
	}
	shuffledNames = transitionalNames;
	console.log('Shuffle was performed successfully!');
	currentSong = 0;
	showFirst();
}

/**
 * Loads the first element of shuffled song array to the HTML. Also turns off the overlay.
 */	
function showFirst() {
	position.value = 1;
	if (audiopl.paused && audiopl.src == '') {
		audiopl.src = getLink(shuffledNames[0]);
		changeTitle();
		document.getElementById('overlay').style.display = "none";
		document.getElementById('load_spinner').style.display = "none";
	}
}

/**
 * Changes title of song on switch. Also removes extension from the title.
 */	
function changeTitle() {
	let title = shuffledNames[currentSong];
	title = title.replace("AC_DC", "AC/DC")
	songName.innerHTML = title.slice(0, (title.length - 4));
	if (songName.style.display == 'none')
		songName.style.display = 'inline-block';
}


/**
 * Sets the logic of toggle button. Also opens/closes contexts.
 */
function toggleMusic() {
	if (audiopl.src != '' && audiopl.paused) {
		playFlag = true;
		openContext();
		audiopl.play();
		toggleBut.src = "res/pause.png";
	}
	else if (audiopl.src != '' && !audiopl.paused) {
		playFlag = false;
		audiopl.pause();
		toggleBut.src = "res/play.png"
	}
}


/**
 * Sets the logic of next song button. Also changes visuals.
 */
function nextSong() {
	resetDefaults();
	currentSong += 1;
	if (currentSong > (shuffledNames.length - 1))
		currentSong = 0;
	audiopl.src = getLink(shuffledNames[currentSong]);
	openContext();
	toggleMusic();
	changeTitle();
}

/**
 * Resets slider variables to defaults.
 */
function resetDefaults() {
	position.value = 1;
	audiopl.currentTime = 0;
}

/**
 * Sets the logic of previous song button. Also visual changes.
 */
function previousSong() {
	resetDefaults();
	currentSong -= 1;
	if (currentSong < 0)
		currentSong = shuffledNames.length - 1;
	audiopl.src = getLink(shuffledNames[currentSong]);
	openContext();
	toggleMusic();
	changeTitle();
}

/**
 * Gets signed link via GET request using "Key" parameter.
 * @param {string} title. Song[i].Key (title of song).
 * @return {string} url. Signed url for audio.src.
 */
function getLink(title) {
	return "https://public-music-storage.s3.amazonaws.com/" + title;
}

/**
 * Opens new context for current song.
 */
function openContext() {
	// If there is no active audio context, it opens new.
	if(audioContext === undefined) {
		audioContext = new AudioContext();
		// If the source is already connected to context, nothing happens.
		if (audioSrc === undefined)
			audioSrc = audioContext.createMediaElementSource(audiopl);
		console.log("Created AudioContext");
		console.log("Sample rate: " + audioContext.sampleRate);
		analyser = audioContext.createAnalyser();
		audioSrc.connect(analyser);
		analyser.connect(audioContext.destination);
		analyser.smoothingTimeConstant = 0.7;
		analyser.fftSize = 256;
		
		console.log('AudioContext is up, sample rate: ' + audioContext.sampleRate);

			/**
		 * Gets pixel ratio of current device for correct drawing on canvas with high sharpness.
		 * @param {canvas object} canvas.
		 * @return {canvas_context} ctx.
		 */
		function setupCanvas(canvas) {
			dpr = window.devicePixelRatio || 1;
			let rect = canvas.getBoundingClientRect();
			canvas.width = rect.width * dpr;
			canvas.height = rect.height * dpr;
			let ctx = canvas.getContext('2d');
			ctx.scale(dpr, dpr);
			return ctx;
		}
	
	canvas = document.getElementById('canvas');
	visualctx = setupCanvas(canvas);
	
	
    render_frame();
	}
	
	

}

/**
 * Draws new frame of spectrum visualization.
 */
function render_frame() {
    const ctx = visualctx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const capHeight = 2;
    const barSpacing = 25;
    const barWidth = 13;
    const barHeight = canvas.height - capHeight;
    const nOfBars = Math.round(canvas.width/barSpacing);
    
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);
    
    const styles = {
    	cap_style: '#fff',
    	gradient: (() => {
    		const g = ctx.createLinearGradient(0, barHeight, 0, 0);
		    g.addColorStop(1, '#0f3443');
		    g.addColorStop(0.5, '#34e89e');
		    g.addColorStop(0, 'hsl( 120, 100%, 50% )');
		    return g;
    	})()
    };
    // Setting of upper limit on bars so there is no empty bars at the end any more.
    const frequencyUpper = audioContext.sampleRate / 2;
    const frequencyLimit = Math.min(16e3, frequencyUpper);
    
    // Frequency step per bar.
    const step = 
    	(frequencyData.length * (frequencyLimit / frequencyUpper) - 1) 
		/ (nOfBars - 1);
    
    for(let i = 0; i < nOfBars; i++) {
    	// Normalized value (0..1) - proportion 'bar_height/canvas_height'.
    	const value = frequencyData[Math.floor(i * step)] / 255;
    	//  _____________
    	// |------- y = 0
    	// |---||-- y = capHeight
    	// |---||--
    	// |---||--
    	// |---||-- y = barHeight + capHeight
    
    	// Bar
    	let x_position = barSpacing / 2 + i * barSpacing;
	if (( x_position + barWidth) < canvas.width / dpr) {
    		ctx.fillStyle = styles.gradient;
    		ctx.fillRect(x_position,
    			barHeight - barHeight * value + capHeight,
    			barWidth,
    			barHeight - barHeight * (1 - value)
    		);
     		// Top of the bar (cap)
    		ctx.fillStyle = styles.cap_style;
    		ctx.fillRect(
    			x_position,
    			barHeight - barHeight * value,
    			barWidth,
    			capHeight
    		);
	}
    }
	// Closure
	requestAnimationFrame(render_frame);
}

/**
 * The boot and the listeners' logic.
 */
window.onload = function() {
	/**
	 * Loads the overlay at the very beginning.
	 */
	(function initOverlay() {
		document.getElementById('overlay').style.display = "block";
		document.getElementById('load_spinner').style.display = "block";
	})();
	
	/**
	 * Ajax call. Gets information in "Key" field of objects on disk.
	 */
	(function loadSongs() {
		$.ajax({
			type: "GET",
			url: 'https://public-music-storage.s3.amazonaws.com/',
			dataType: "xml",
			success: function (xml) {
				$(xml).find('Key').each(function() {
					receivedNames.push(this.innerHTML);
				});
	            console.log("Songs were received successfully!");
	            shuffleMusic();
			}
		});
	})();
	

	/**
	 * Switches to the next song if the previous has ended.
	 */
	audiopl.addEventListener("ended", nextSongOnEnd);

	function nextSongOnEnd() {
		currentSong += 1;
		if (currentSong > (shuffledNames.length - 1))
			currentSong = 0;
		changeTitle();
		audiopl.src = getLink(shuffledNames[currentSong]);
		audiopl.play();
	}

	/**
	 * Updates displayed current time.
	 */
	position.addEventListener('input', changeTime);

	function changeTime() {
		if (audiopl.paused)
			playFlag = false;
		else
			playFlag = true;
		audiopl.currentTime = audiopl.duration / 100 * position.value;
		if (Math.floor(audiopl.currentTime % 60) < 10)
			timing.innerHTML = Math.floor(audiopl.currentTime / 60) + ':0' + Math.floor(audiopl.currentTime % 60);
		else
			timing.innerHTML = Math.floor(audiopl.currentTime / 60) + ':' + Math.floor(audiopl.currentTime % 60);
		if (playFlag == true)
			audiopl.play();
	};

	/**
	 * Moves slider according to current time.
	 */
	audiopl.addEventListener("timeupdate", moveSlider); 

	function moveSlider() {
		if (audiopl.currentTime == 0)
			position.value = 1;
		else
			position.value = (audiopl.currentTime * 100 / audiopl.duration);
		
		if (Math.floor(audiopl.currentTime % 60) < 10)
			timing.innerHTML = Math.floor(audiopl.currentTime / 60) + ':0' + Math.floor(audiopl.currentTime % 60);
		else 
			timing.innerHTML = Math.floor(audiopl.currentTime / 60) + ':' + Math.floor(audiopl.currentTime % 60);
	}

	/**
	 * Changes the volume according to the slider position.
	 */
	document.getElementById('volume_regulator').addEventListener("input", changeVolume);

	function changeVolume() {
		audiopl.volume = document.getElementById('volume_regulator').value;
	}

	/**
	 * Toggles mute on click.
	 */
	volumeBut.addEventListener("click", toggleMute);

	function toggleMute() {
		if (!audiopl.muted) {
			audiopl.muted = true;
			volumeBut.src = "res/mute.png";
		} else {
			audiopl.muted = false;
			volumeBut.src = "res/volume.png";
		}
	}
}