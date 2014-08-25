$fn=80; // resolutie (zet lager om te debuggen)

thickness = 1.5;
bottom_thickness = 1.05;
width = 100;
depth = 185;
height = 35;

fudge = 12.1;

xlr_diameter = 24;

xlr_srew_diameter = 3.53;
xlr_width = 26.03;
xlr_height = 31.04;
xlr_srew_distance_from_side = 1.80;
xlr_screw_centerdistance_width = xlr_width/2 - xlr_srew_distance_from_side - xlr_srew_diameter/2;
xlr_screw_centerdistance_height = xlr_height/2 - xlr_srew_distance_from_side - xlr_srew_diameter/2;


yun_bottom_offset = 6.00;
yun_pcb_thickness = 1.67;
yun_connector_offset = yun_bottom_offset + yun_pcb_thickness;

xlr_spacing = 2;
xlr_distance = xlr_width + xlr_spacing;




module gat (){
	translate([0,0,-(thickness+fudge)/2]) cylinder(thickness+fudge,d=xlr_diameter,true);
	translate([xlr_screw_centerdistance_width,12.5,-(thickness+fudge)/2]) cylinder(thickness+fudge,d=xlr_srew_diameter,true);
	translate([-xlr_screw_centerdistance_width,-12.5,-(thickness+fudge)/2]) cylinder(thickness+fudge,d=xlr_srew_diameter,true);
}







//left side:
translate([-depth/2, -width/2, 0]) cube([depth, thickness, height]);
//right side:
translate([-depth/2, width/2-thickness, 0]) {
	difference() {

 		cube([depth, thickness, height]);
		for ( i = [0 : 5] ) {
			translate([(-xlr_distance/2+xlr_distance*6)+(depth-6*xlr_distance)/2-i*xlr_distance, 0, 18]) rotate(a=[90,0,0]) gat();
		}

	}
}
//back:
translate([-depth/2, -width/2, 0]) cube([thickness, width, height]);

// bottom:
translate([-depth/2, -width/2, 0]) cube([depth, width, bottom_thickness]);


//front:



ethernet_ypos = -width/2+thickness+16;
difference() {

	// plate:
	translate([depth/2-thickness, -width/2, 0]) cube([thickness, width, height]);


	// holes:

	// ehternet hole
	translate([depth/2-20, ethernet_ypos, yun_connector_offset]) cube([40, 16.20, 14]);

	// micro usb hole:
	translate([depth/2-20, ethernet_ypos+24.32, yun_connector_offset]) cube([40, 8.02, 4]);

	// usb hole
	translate([depth/2-20, ethernet_ypos+35.56, yun_connector_offset]) cube([40, 7, 15]);

}


// support holes:
supportholes_height = yun_bottom_offset;
module supporthole(){
	translate([0,0,supportholes_height/2]){
		difference() {
			cylinder(h=supportholes_height, d=5, center=true);
			cylinder(h=supportholes_height*2, d=2.1, center=true);
		}
	}
}

// voorste:
translate([depth/2-thickness-13.83, ethernet_ypos-2.28, bottom_thickness]) supporthole();
translate([depth/2-thickness-13.83, ethernet_ypos+45.39, bottom_thickness]) supporthole();

// achterste:
translate([depth/2-thickness-65.88, ethernet_ypos+12.51, bottom_thickness]) supporthole();
translate([depth/2-thickness-65.88, ethernet_ypos+12.51+28.07, bottom_thickness]) supporthole();




module lidhole(height){
	translate([0,0,height/2]) difference() {
		cube(size=[5,5,height], center=true);
		cylinder(h=height*2, d=2.1, center=true);
	}
}

translate([(depth/2-5/2-thickness),+(width/2-5/2-thickness),0]) lidhole(height);
translate([(depth/2-5/2-thickness),-(width/2-5/2-thickness),0]) lidhole(height);

translate([-(depth/2-5/2-thickness),+(width/2-5/2-thickness),0]) lidhole(height);
translate([-(depth/2-5/2-thickness),-(width/2-5/2-thickness),0]) lidhole(height);










