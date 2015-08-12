; (function ($$) {
    'use strict';

    var defaults = {
        fit: true, // whether to fit the viewport to the graph
        padding: 30, // padding used on fit
        boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
        avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
        rows: undefined, // force num of rows in the 
        columns: undefined, // force num of cols in the 
        position: function (node) { }, // returns { row, col } for element
        animate: false, // whether to transition the node positions
        animationDuration: 500, // duration of animation in ms if enabled
        ready: undefined, // callback on layoutready
        stop: undefined // callback on layoutstop
    };

    function ColumnarLayout(options) {
        this.options = $$.util.extend({}, defaults, options);
    }

    ColumnarLayout.prototype.run = function () {
        var params = this.options;
        var options = params;

        var cy = params.cy;
        var eles = options.eles;
        var nodes = eles.nodes().not(':parent');

        var bb = $$.util.makeBoundingBox(options.boundingBox ? options.boundingBox : {
            x1: 0, y1: 0, w: cy.width(), h: cy.height()
        });

        if (bb.h === 0 || bb.w === 0) {
            nodes.layoutPositions(this, options, function () {
                return { x: bb.x1, y: bb.y1 };
            });

        } else {			
			// -------------- start columnar ------------------
            // width/height * splits^2 = cells where splits is number of times to split width
            var cells = nodes.size();
            var splits = Math.sqrt(cells * bb.h / bb.w);
            var rows = Math.round(splits);
            var cols = Math.round(bb.w / bb.h * splits);

            var small = function (val) {
                if (val == null) {
                    return Math.min(rows, cols);
                } else {
                    var min = Math.min(rows, cols);
                    if (min == rows) {
                        rows = val;
                    } else {
                        cols = val;
                    }
                }
            };

            var large = function (val) {
                if (val == null) {
                    return Math.max(rows, cols);
                } else {
                    var max = Math.max(rows, cols);
                    if (max == rows) {
                        rows = val;
                    } else {
                        cols = val;
                    }
                }
            };

            // if rows or columns were set in options, use those values
            if (options.rows != null && options.columns != null) {
                rows = options.rows;
                cols = options.columns;
            } else if (options.rows != null && options.columns == null) {
                rows = options.rows;
                cols = Math.ceil(cells / rows);
            } else if (options.rows == null && options.columns != null) {
                cols = options.columns;
                rows = Math.ceil(cells / cols);
            }

                // otherwise use the automatic values and adjust accordingly

                // if rounding was up, see if we can reduce rows or columns
            else if (cols * rows > cells) {
                var sm = small();
                var lg = large();

                // reducing the small side takes away the most cells, so try it first
                if ((sm - 1) * lg >= cells) {
                    small(sm - 1);
                } else if ((lg - 1) * sm >= cells) {
                    large(lg - 1);
                }
            } else {

                // if rounding was too low, add rows or columns
                while (cols * rows < cells) {
                    var sm = small();
                    var lg = large();

                    // try to add to larger side first (adds less in multiplication)
                    if ((lg + 1) * sm >= cells) {
                        large(lg + 1);
                    } else {
                        small(sm + 1);
                    }
                }
            }

            var cellWidth = bb.w / cols;
            var cellHeight = bb.h / rows;

            if (options.avoidOverlap) {
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    var w = node.outerWidth();
                    var h = node.outerHeight();

                    cellWidth = Math.max(cellWidth, w);
                    cellHeight = Math.max(cellHeight, h);
                }
            }

            var cellUsed = {}; // e.g. 'c-0-2' => true

            var used = function (row, col) {
                return cellUsed['c-' + row + '-' + col] ? true : false;
            };

            var use = function (row, col) {
                cellUsed['c-' + row + '-' + col] = true;
            };

            // to keep track of current cell position
            var row = 0;
            var col = 0;
            var moveToNextCell = function () {
                col++;
                if (col >= cols) {
                    col = 0;
                    row++;
                }
            };

            // get a cache of all the manual positions
            var id2manPos = {};
			var nodesSat = [];
            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                var rcPos = options.position(node);

                if (rcPos && (rcPos.row !== undefined || rcPos.col !== undefined) || rcPos.gtype !== undefined) { // must have at least row or col def'd
                    if (rcPos.gtype == 'columnar')
					{
						var pos = {
							row: rcPos.row,
							col: rcPos.col
						};

						if (pos.col === undefined) { // find unused col
							pos.col = 0;

							while (used(pos.row, pos.col)) {
								pos.col++;
							}
						} else if (pos.row === undefined) { // find unused row
							pos.row = 0;

							while (used(pos.row, pos.col)) {
								pos.row++;
							}
						}

						id2manPos[node.id()] = pos;
						use(pos.row, pos.col);
					}
					else if (rcPos.gtype == 'satellite')
					{
						nodesSat.push(nodes[i]); 
					}
                }
            }
			// -------------- end columnar ------------------
			// -------------- start satellite -----------------
				var center = {
				  x: bb.x1 + bb.w/2,
				  y: bb.y1 + bb.h/2
				};
				
				var theta = 3/2 * Math.PI;
				var dTheta = 2 * Math.PI / nodesSat.length;
				var r;

				var minDistance = 0;
				for( var i = 0; i < nodesSat.length; i++ ){
				  var w = nodesSat[i].outerWidth();
				  var h = nodesSat[i].outerHeight();
				  
				  minDistance = Math.max(minDistance, w, h);
				}

				if( $$.is.number(options.radius) ){
				  r = options.radius;
				} else if( nodesSat.length <= 1 ){
				  r = 0;
				} else {
				  r = Math.min( bb.h, bb.w )/2 - minDistance;
				}

				// calculate the radius
				if( nodesSat.length > 1 && options.avoidOverlap ){ // but only if more than one node (can't overlap)
				  minDistance *= 1.75; // just to have some nice spacing

				  var dTheta = 2 * Math.PI / nodesSat.length;
				  var dcos = Math.cos(dTheta) - Math.cos(0);
				  var dsin = Math.sin(dTheta) - Math.sin(0);
				  var rMin = Math.sqrt( minDistance * minDistance / ( dcos*dcos + dsin*dsin ) ); // s.t. no nodesSat overlapping
				  r = Math.max( rMin, r );
				}
			// -------------- end satellite --------------------
            var getPos = function (i, element) {
				if (element.data('gtype') == 'columnar')
                {
					var x, y;

					if (element.locked() || element.isFullAutoParent()) {
						return false;
					}

					// see if we have a manual position set
					var rcPos = id2manPos[element.id()];
					if (rcPos) {
						x = rcPos.col * cellWidth + cellWidth / 2 + bb.x1;
						y = rcPos.row * cellHeight + cellHeight / 2 + bb.y1 + 2*r;

					} else { // otherwise set automatically

						while (used(row, col)) {
							moveToNextCell();
						}

						x = col * cellWidth + cellWidth / 2 + bb.x1;
						y = row * cellHeight + cellHeight / 2 + bb.y1 + 2*r;
						use(row, col);

						moveToNextCell();
					}

					return { x: x, y: y };
				}
				else if (element.data('gtype') == 'satellite')
				{
					var rx = r * Math.cos( theta );
					var ry = r * Math.sin( theta );
					var pos = {
						x: center.x + rx,
						y: center.y + ry
					};

					theta = options.counterclockwise ? theta - dTheta : theta + dTheta;
					return pos;
				}
            };

            nodes.layoutPositions(this, options, getPos);
        }

        return this; // chaining

    };

    $$('layout', 'columnar', ColumnarLayout);

})(cytoscape);
