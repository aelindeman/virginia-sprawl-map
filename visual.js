/*
Alex Lindeman
2015-09-05-ongoing
Javascript support file for the GISC 351 Virginia map project

Ideally this is constructed in an AJAX completion callback, with a JSON data payload.

Requirements:
  - jQuery - https://jquery.com
  - jQuery easing - https://jqueryui.com/easing/
  - animate-numbers.js - https://github.com/talmand/jquery-animate-numbers
  - Lunar - https://github.com/toddmotto/lunar
*/

'use strict';

(function() {
	// constants
	var data, legend, county_name_placeholder;

	VizHelper.prototype.VERSION = '0.2.0';

	// constructor
	function VizHelper (data) {
		if (!(this instanceof VizHelper)) {
			return new VizHelper(data);
		}

		this.data = data;
		this.legend = {
			'area': {
				'title': 'Change in consumed land',
				'units': 'km²',
				'scale': [-1, 0, 60, 120, 180],
				'legend': [false, '1 - 60', '61 - 120', '121 - 180', '181 - 255']
			},
			'pop': {
				'title': 'Proportion of state population',
				'units': '%',
				'scale': [-1, 0, 0.005, 0.01, 0.02],
				'legend': ['decrease', '0 - 0.5%', '0.5% - 1%', '1% - 2%', '2% +']
			}
		};
		this.county_name_placeholder = $('h3.county-name').text();

		this.register_svg_helper_data();
		this.register_svg_click_handlers();
		this.register_map_picker_handlers();

		if ($('.map-panel input').is(':checked')) {
			this.draw_map($('.map-panel input:checked:first').val());
			$('.map-panel .legend').fadeIn(375);
		}
	};

	VizHelper.prototype.register_svg_helper_data = function() {
		$(document.getElementById('map')).ready(function () {
			// translate ids to data attributes on svg paths
			$('#county_outlines > g[id], #county_outlines > path[id]').each(function () {
				var county = $(this);
				var id = county.attr('id');
				if (county.attr('id').match(/^[A-Za-z_]+$/g) !== null) {
					var name = county.attr('id').replace(/_/g, ' ').replace(/Ci$/g, ' City');
					county.attr({'title': name});
					county.data({'name': name, 'lookup': id});
				}
			});
		});
	};

	VizHelper.prototype.register_svg_click_handlers = function() {
		var context = this;
		var county_name_label = $('#info .county-name'), info_container = $('#info ul');

		$('#county_outlines > g[id], #county_outlines > path[id]').not('.county-selected').on('click', function (event) {
			if (county_name_label.text() != $(this).attr('id').replace(/_/g, ' ').replace(/Ci$/g, ' City')) {
				var sel;
				if (sel = document.querySelector('.county-selected')) {
					lunar.removeClass(sel, 'county-selected');
				}
				lunar.addClass(this, 'county-selected');
				
				var lookup = $(this).data('lookup'), name = $(this).data('name');

				info_container.delay(125).fadeIn(375);
				county_name_label.animate({'opacity': 0}, 125, function() {
					context.draw_panel(lookup);
					county_name_label.addClass('county-selected').text(name);

					var scroll_to = Math.max(0, $('#notes').position().top - $(window).height());
					$('html, body').animate({scrollTop: scroll_to}, 375);
				}).animate({'opacity': 1}, 375);
			}
		});
		$('#map svg').on('click', function (event) {
			if (event.target.nodeName != 'path') {
				var sel;
				if (sel = document.querySelector('.county-selected')) {
					lunar.removeClass(sel, 'county-selected');
				}
				if (county_name_label.text() != context.county_name_placeholder) {
					info_container.fadeOut(125);
					county_name_label.animate({'opacity': 0}, 125, function () {
						$(this).removeClass('county-selected').text(context.county_name_placeholder);
					}).animate({'opacity': 1}, 750);
				}
			}
		});

		info_container.hide();
	};

	VizHelper.prototype.register_map_picker_handlers = function() {
		var context = this;
		$('.map-panel input').on('change', function() {
			$('.map-panel .legend').fadeOut(125, function () {
				var map = $('.map-panel input:checked:first').val();
				context.draw_map(map);
			}).fadeIn(375);
		});
	};

	VizHelper.prototype.draw_map = function(map) {
		var context = this;
		map = (typeof map == 'string') ? map : $('.map-panel input:checked:first').val();
		this.draw_legend(map);

		$('#county_outlines > g[id], #county_outlines > path[id]').each(function (index, value) {
			var name = $(this).attr('id').replace(/_/g, ' ').replace(/Ci$/g, ' city');
			var data =
				(map == 'area') ? context.lookup(name, 'not5to5_sqkm') :
				(map == 'pop') ? context.lookup(name, 'pct_change_rel') :
				null;

			// calculate scale value
			var scale = context.legend[map].scale;
			var b = scale.length;
			if (data) while (0 < b --) if (data > scale[b]) break;

			if (typeof lunar == 'object' && lunar instanceof Object) {
				for (var i = 0; i < 5; i ++) if (lunar.hasClass(this, 'value-' + i)) lunar.removeClass(this, 'value-' + i);
				if (!lunar.hasClass(this, 'scale')) lunar.addClass(this, 'scale');
				lunar.addClass(this, 'value-' + b);
			} else {
				console.warn('lunar not loaded, so can\'t add classes to svg elements - see https://github.com/toddmotto/lunar');
			}
		});
	};

	VizHelper.prototype.draw_legend = function(map) {
		for (var v = 0; v < this.legend[map].legend.length; v ++) {
			var item;
			if ((item = this.legend[map].legend[v]) != false) $('.legend li.value-' + v).text(item).show();
			else $('.legend li.value-' + v).hide();
		}
	};

	// searches for a county by name
	VizHelper.prototype.lookup = function(search, field) {
		search = search.replace(/_/g, ' ').replace(/Ci$/g, ' city') || null;
		for (var i = 0; i < this.data.length; i ++) {
			if (this.data[i].label.slice(0, search.length).toLowerCase() == search.toLowerCase()) {
				return (field === undefined || !this.data[i].hasOwnProperty(field)) ?
					this.data[i] :
					this.data[i][field];
			}
		}
		return null;
	};

	VizHelper.prototype.draw_panel = function(county) {
		county = this.lookup(county);
		var s = 750, c = ',', e = 'easeOutCubic';

		$('.population-change').numerator({toValue: (county.pct_change - 1) * 100, duration: s, rounding: 1, easing: e});
		$('.population-raw-1990').numerator({toValue: county.pop_1990, duration: s, delimiter: c, easing: e});
		$('.population-raw-2010').numerator({toValue: county.pop_2010, duration: s, delimiter: c, easing: e});
		$('.population-change-relative').numerator({toValue: county.pct_change_rel * 100, duration: s, rounding: 2, delimiter: c, easing: e});

		$('.developed-land-change').numerator({toValue: county.pct5_increase * 100, duration: s, rounding: 1, easing: e});
		$('.developed-land-1992').numerator({toValue: county.already5_sqkm, duration: s, rounding: 1, easing: e});
		$('.developed-land-2006').numerator({toValue: county.total5_sqkm, duration: s, rounding: 1, easing: e});
		$('.developed-land-relative').numerator({toValue: county.pct5_increase_relative * 100, duration: s, rounding: 2, easing: e});
	};

	// registrar
	if (typeof window == 'object' && typeof window.document == 'object') {
		window.VizHelper = VizHelper;
	}
})();
