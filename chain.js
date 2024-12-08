// CS535, Project #2, Ashton Johnson
// 
// This program implements a visual program with six distinctly colored "links."
// They're called links because they look like links of a chain.
// These links are base links that can be used to create copies.
// There is no more functionality to the base links other than to create copies.
// The copies can be dragged around the gray background.
// By holding "SHIFT" and clicking a copy, it can be rotated clockwise by 45 degrees about its center.
// By holding "CONTROL" and clicking a copy, it can be deleted.
// The program is started by opening the html file in a browser.
// Hitting "F5" in most browsers resets the canvas.
//
// Originals = the 6 model links
// Copies = the template links pulled off of the 6 model links

"use strict"

var canvas;
var gl;

var projection; // Projection matrix uniform shader variable location
var transformation; // Projection matrix uniform shader variable location
var vPosition;
var vColor;

// State representation
var Originals; // 6 main links
var Copies; // Holds each copy of a main link
var NumCopies; // Tracks number of copies
var BlockIdToBeMoved; // This block is moving
var MoveCount;
var OldX;
var OldY;

// Shape variables for easy manipulation
var Radius = 10;
var RectH = 18;
var RectV = 6;
var CircleIts = 20;
var NumVertices = (2 * CircleIts) + 6;

function CPiece (color, xc, yc) {
    this.color = color;
    this.points = [];
    this.xc = xc;
    this.yc = yc;

    // Calculate the points here for each link

    // Rectangle
    var x1 = xc + RectH;
    var y1 = yc + RectV;
    var x2 = xc - RectH;
    var y2 = yc + RectV;
    var x3 = xc - RectH;
    var y3 = yc - RectV;
    var x4 = xc + RectH;
    var y4 = yc - RectV;
    this.points.push(vec2(xc, yc));
    this.points.push(vec2(x1, y1));
    this.points.push(vec2(x2, y2));
    this.points.push(vec2(x4, y4));
    this.points.push(vec2(x3, y3));

    // Left circle
    var cx1 = xc - RectH; 
    var cy1 = yc; 
    for (i = 0; i <= CircleIts; i++){
        this.points.push(vec2(cx1+Radius*Math.cos(i * 2 * Math.PI / CircleIts), cy1+Radius*Math.sin(i * 2 * Math.PI / CircleIts)));
    }

    // Right circle
    var cx2 = xc + RectH; 
    var cy2 = yc; 
    for (i = 0; i <= CircleIts; i++){
        this.points.push(vec2(cx2+Radius*Math.cos(i * 2 * Math.PI / CircleIts), cy2+Radius*Math.sin(i * 2 * Math.PI / CircleIts)));
    }

    // Colors
    this.colors=[];
    for (var i=0; i<NumVertices; i++) this.colors.push(color);

    this.vBuffer=0;
    this.cBuffer=0;

    this.OffsetX=0;
    this.OffsetY=0;
    this.Angle=0;

    this.UpdateOffset = function(dx, dy) {
        this.OffsetX += dx;
        this.OffsetY += dy;
    }

    this.SetOffset = function(dx, dy) {
        this.OffsetX = dx;
        this.OffsetY = dy;
    }

    this.UpdateAngle = function(deg) {
        this.Angle += deg;
    }

    this.SetAngle = function(deg) {
        this.Angle = deg;
    }

    this.isLeft = function(x, y, id) {	// Is Point (x, y) located to the left when walking from id to id+1?
        var id1=(id+1)%NumVertices;
        return (y-this.points[id][1])*(this.points[id1][0]-this.points[id][0])>(x-this.points[id][0])*(this.points[id1][1]-this.points[id][1]);
    }

    this.transform = function(x, y) {
        var theta = -Math.PI/180*this.Angle;	// in radians
        var x2 = this.points[0][0] + (x - this.points[0][0]-this.OffsetX) * Math.cos(theta) - (y - this.points[0][1]-this.OffsetY) * Math.sin(theta);
        var y2 = this.points[0][1] + (x - this.points[0][0]-this.OffsetX) * Math.sin(theta) + (y - this.points[0][1]-this.OffsetY) * Math.cos(theta);
        return vec2(x2, y2);
    }

    this.isInside = function(x, y) {
        // Transform for calulations
        var p=this.transform(x, y);
        // Checks the bridge
        for (var i=(5+(CircleIts/4)); i<(5+(CircleIts/4)) + (CircleIts/2)+1; i++) {
            if (!this.isLeft(p[0], p[1], i)) return false; // If not left of two points, false
        }
        // Left Circle
        for (var i=(5+(7*CircleIts/4)+1); i<(5+(7*CircleIts/4) + (CircleIts/4)); i++) {
            if (!this.isLeft(p[0], p[1], i)) return false; // If not left of two points, false
        }
        // Right Circle
        for (var i=(5+CircleIts+1); i<(5+(CircleIts + CircleIts/4)+1); i++) {
            if (!this.isLeft(p[0], p[1], i)) return false; // If not left of two points, false
        }
        return true; // Success
    }

    this.init = function() {
        this.vBuffer = gl.createBuffer();
        gl.bindBuffer( gl.ARRAY_BUFFER, this.vBuffer );
        gl.bufferData( gl.ARRAY_BUFFER, flatten(this.points), gl.STATIC_DRAW );
        this.cBuffer = gl.createBuffer();
        gl.bindBuffer( gl.ARRAY_BUFFER, this.cBuffer );
        gl.bufferData( gl.ARRAY_BUFFER, flatten(this.colors), gl.STATIC_DRAW );
    }

    this.draw = function() {
        var tm=translate(this.points[0][0]+this.OffsetX, this.points[0][1]+this.OffsetY, 0.0);
        tm=mult(tm, rotate(this.Angle, vec3(0, 0, 1)));
        tm=mult(tm, translate(-this.points[0][0], -this.points[0][1], 0.0));
        gl.uniformMatrix4fv( transformation, gl.TRUE, flatten(tm) );

        gl.bindBuffer( gl.ARRAY_BUFFER, this.vBuffer );
        gl.vertexAttribPointer( vPosition, 2, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( vPosition );

        gl.bindBuffer( gl.ARRAY_BUFFER, this.cBuffer );
        gl.vertexAttribPointer( vColor, 4, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray( vColor );

        gl.drawArrays( gl.TRIANGLE_STRIP, 0, 5 ); // Rectangle
        gl.drawArrays( gl.TRIANGLE_FAN, 5, CircleIts + 1 ); // Left Circle
        gl.drawArrays( gl.TRIANGLE_FAN, 6 + CircleIts, CircleIts + 1 ); // Right Circle
    }

}

window.onload = function initialize() {
    canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    canvas.addEventListener("mousedown", function(event){
        if (event.button!=0) return; // left button only
        var x = event.pageX - canvas.offsetLeft;
        var y = event.pageY - canvas.offsetTop;
        y=canvas.height-y;
        if (event.shiftKey) {  // with shift key, rotate copies counter-clockwise
            for (var i=NumCopies-1; i>=0; i--) {	// search from last to first
                if (Copies[i].isInside(x, y)) {
                    // move Copies[i] to the top
                    var temp=Copies[i];
                    for (var j=i; j<NumCopies-1; j++) Copies[j]=Copies[j+1];
                    Copies[NumCopies-1]=temp;
                    // rotate the block
                    Copies[NumCopies-1].UpdateAngle(45);
                    // redraw
                    window.requestAnimFrame(render);
                    return;
                }
            }
            return;
        }
        if (event.ctrlKey) { // with control key, delete copies
            for (var i=NumCopies-1; i>=0; i--) {	// search from last to first
                if (Copies[i].isInside(x, y)) {
                    Copies.splice(i, 1); // Remove Copies[i] from the Copies array
                    NumCopies--; // recount
                    window.requestAnimFrame(render); // redraw
                    return;
                }
            }
            return;
        }
        for (var i=5; i>=0; i--) {	// search Originals from last to first
            if (Originals[i].isInside(x, y)) {
                // create copy and place it on top
                NumCopies++;
                Copies.push(new CPiece(Originals[i].color, Originals[i].xc, Originals[i].yc));
                Copies[NumCopies-1].init();
                // remember the one to be moved
                BlockIdToBeMoved=NumCopies-1;
                MoveCount=0;
                OldX=x;
                OldY=y;
                // redraw
                window.requestAnimFrame(render);
                break;
            }
        }
        for (var i=NumCopies-1; i>=0; i--) { // search Copies from last to first
            if (Copies[i].isInside(x, y)) {
                // move Copies[i] to the top
                var temp=Copies[i];
                for (var j=i; j<NumCopies-1; j++) Copies[j]=Copies[j+1];
                Copies[NumCopies-1]=temp;
                // remember the one to be moved
                BlockIdToBeMoved=NumCopies-1;
                MoveCount=0;
                OldX=x;
                OldY=y;
                // redraw
                window.requestAnimFrame(render);
                break;
            }
        }
    });

    canvas.addEventListener("mouseup", function(event){
        if (BlockIdToBeMoved>=0) BlockIdToBeMoved=-1;
    });

    canvas.addEventListener("mousemove", function(event){
        if (BlockIdToBeMoved>=0) {  // if dragging
            var x = event.pageX - canvas.offsetLeft;
            var y = event.pageY - canvas.offsetTop;
            y=canvas.height-y;
            Copies[BlockIdToBeMoved].UpdateOffset(x-OldX, y-OldY);
            MoveCount++;
            OldX=x;
            OldY=y;
            window.requestAnimFrame(render);
        }
    });

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 0.5, 0.5, 0.5, 1.0 );

    //
    //  Load shaders and initialize attribute buffers
    //
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // Initial State
    Originals=[];
    Copies=[];
    NumCopies = 0;
    // Originals declarations
    Originals.push(new CPiece(vec4(1.0, 0.0, 0.0, 1.0), 200, 575));
    Originals.push(new CPiece(vec4(0.0, 1.0, 0.0, 1.0), 280, 575));
    Originals.push(new CPiece(vec4(0.0, 0.0, 1.0, 1.0), 360, 575));
    Originals.push(new CPiece(vec4(1.0, 1.0, 0.0, 1.0), 440, 575));
    Originals.push(new CPiece(vec4(1.0, 0.0, 1.0, 1.0), 520, 575));
    Originals.push(new CPiece(vec4(0.0, 1.0, 1.0, 1.0), 600, 575));

    // Initialize Originals
    for (var i=0; i<Originals.length; i++) Originals[i].init();

    BlockIdToBeMoved=-1; // no piece selected

    projection = gl.getUniformLocation( program, "projection" );
    var pm = ortho( 0.0, canvas.width, 0.0, canvas.height, -1.0, 1.0 );
    gl.uniformMatrix4fv( projection, gl.TRUE, flatten(pm) );

    transformation = gl.getUniformLocation( program, "transformation" );

    vPosition = gl.getAttribLocation( program, "vPosition" );
    vColor = gl.getAttribLocation( program, "vColor" );

    render();
}

// Draws Originals first and then Copies to assure that the copy will be moved when the duplicate is created
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (var i=0; i<Originals.length; i++) Originals[i].draw();
    for (var i=0; i<NumCopies; i++) Copies[i].draw();
}