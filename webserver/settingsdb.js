var fs = require('fs');
var path = require('path');


var FILE = path.join( __dirname, "settings.json");

var isSaving = false;


function load (callback){
	fs.exists(FILE, function (exists) {
		if(!exists) return callback(null, {}); //empty object

		fs.readFile(FILE , 'utf8', function (err, data) {
			if (err) return callback(err);
			var settings = JSON.parse(data);
			if(callback) callback(null, settings);
			return;
		});
	});
}


function save (settings){
	if(isSaving)
		return; //anders krijgen we corrupte files

	// console.log("> saving");
	isSaving = true;
	fs.writeFile( FILE, JSON.stringify(settings), function (err) {
		if(err) console.log(err);
		isSaving = false;
	});
}



exports.load = load;
exports.save = save;
