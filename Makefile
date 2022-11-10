# DIR := $(shell dirname $(lastword $(MAKEFILE_LIST)))

# NODE_MODS  := $(DIR)/node_modules
# PUG        := $(NODE_MODS)/.bin/pug

# TARGET_DIR := build/http
# HTML       := index
# HTML       := $(patsubst %,$(TARGET_DIR)/%.html,$(HTML))
# RESOURCES  := $(shell find src/resources -type f)
# RESOURCES  := $(patsubst src/resources/%,$(TARGET_DIR)/%,$(RESOURCES))
# TEMPLS     := $(wildcard src/pug/templates/*.pug)

# AVR_FIRMWARE := src/avr/bbctrl-avr-firmware.hex
# GPLAN_MOD    := rpi-share/camotics/gplan.so
# GPLAN_TARGET := src/py/camotics/gplan.so
# GPLAN_IMG    := gplan-dev.img

# VERSION  := $(shell jq -r '.version' package.json)
# PY_VERSION  := $(shell jq -r '.version' package.json | sed -E 's|([0-9]+)\.([0-9]+)\.([0-9]+)(-(b)eta\.(.*))?|\1.\2.\3\5\6|g')
# PKG_NAME := dist/bbctrl-$(PY_VERSION).tar.bz2
# FINAL_PKG_NAME := dist/onefinity-$(VERSION).tar.bz2

# SUBPROJECTS := avr boot pwr

# ifndef HOST
# HOST=onefinity
# endif

# ifndef PASSWORD
# PASSWORD=onefinity
# endif

# all: $(HTML) $(RESOURCES)
# 	@for SUB in $(SUBPROJECTS); do $(MAKE) -C src/$$SUB; done

# pkg: all $(AVR_FIRMWARE) bbserial
# 	./setup.py sdist
# 	mv $(PKG_NAME) $(FINAL_PKG_NAME)

# bbserial:
# 	$(MAKE) -C src/bbserial

# gplan: $(GPLAN_TARGET)

# $(GPLAN_TARGET): $(GPLAN_MOD)
# 	cp $< $@

# $(GPLAN_MOD): $(GPLAN_IMG)
# 	./scripts/gplan-init-build.sh
# 	cp ./scripts/gplan-build.sh rpi-share/
# 	chmod +x rpi-share/gplan-build.sh
# 	sudo ./scripts/rpi-chroot.sh $(GPLAN_IMG) /mnt/host/gplan-build.sh

# $(GPLAN_IMG):
# 	./scripts/gplan-init-build.sh

# .PHONY: $(AVR_FIRMWARE)
# $(AVR_FIRMWARE):
# 	$(MAKE) -C src/avr

# update: pkg
# 	curl -i -X PUT -H "Content-Type: multipart/form-data" \
# 	  -F "firmware=@$(FINAL_PKG_NAME)" -F "password=$(PASSWORD)" \
# 	  http://$(HOST)/api/firmware/update
# 	@-tput sgr0 && echo # Fix terminal output

# build/templates.pug: $(TEMPLS)
# 	mkdir -p build
# 	cat $(TEMPLS) >$@

# node_modules: package.json
# 	npm install && touch node_modules

# $(TARGET_DIR)/%: src/resources/%
# 	install -D $< $@

# src/svelte-components/dist/%:
# 	cd src/svelte-components && rm -rf dist && npm run build

# $(TARGET_DIR)/index.html: build/templates.pug
# $(TARGET_DIR)/index.html: $(wildcard src/static/js/*)
# $(TARGET_DIR)/index.html: $(wildcard src/static/css/*)
# $(TARGET_DIR)/index.html: $(wildcard src/pug/templates/*)
# $(TARGET_DIR)/index.html: $(wildcard src/js/*)
# $(TARGET_DIR)/index.html: $(wildcard src/stylus/*)
# $(TARGET_DIR)/index.html: src/resources/config-template.json
# $(TARGET_DIR)/index.html: $(wildcard src/resources/onefinity*defaults.json)
# $(TARGET_DIR)/index.html: $(wildcard src/svelte-components/dist/*)

# FORCE:

# $(TARGET_DIR)/%.html: src/pug/%.pug node_modules FORCE
# 	cd src/svelte-components && rm -rf dist && npm run build
# 	@mkdir -p $(TARGET_DIR)/svelte-components
# 	cp src/svelte-components/dist/* $(TARGET_DIR)/svelte-components/

# 	@mkdir -p $(TARGET_DIR)
# 	$(PUG) -O pug-opts.js -P $< -o $(TARGET_DIR) || (rm -f $@; exit 1)

# clean:
# 	rm -rf rpi-share
# 	git clean -fxd

# .PHONY: all install clean tidy pkg gplan lint pylint jshint bbserial

DIR := $(shell dirname $(lastword $(MAKEFILE_LIST)))

NODE_MODS  := $(DIR)/node_modules
PUG        := $(NODE_MODS)/.bin/pug

TARGET_DIR := build/http
HTML       := index
HTML       := $(patsubst %,$(TARGET_DIR)/%.html,$(HTML))
# ?

HTML_NETWORK       := network
HTML_NETWORK       := $(patsubst %,$(TARGET_DIR)/%.html,$(HTML_NETWORK))
HTML_CONFIG      := defaultConfig
HTML_CONFIG       := $(patsubst %,$(TARGET_DIR)/%.html,$(HTML_CONFIG))

HTML_DONE      := done
HTML_DONE      := $(patsubst %,$(TARGET_DIR)/%.html,$(HTML_DONE))

HTML_GETSTART      := getStarted
HTML_GETSTART       := $(patsubst %,$(TARGET_DIR)/%.html,$(HTML_GETSTART))

RESOURCES  := $(shell find src/resources -type f)
RESOURCES  := $(patsubst src/resources/%,$(TARGET_DIR)/%,$(RESOURCES))
TEMPLS     := $(wildcard src/pug/templates/*.pug)

AVR_FIRMWARE := src/avr/bbctrl-avr-firmware.hex
GPLAN_MOD    := rpi-share/camotics/gplan.so
GPLAN_TARGET := src/py/camotics/gplan.so
GPLAN_IMG    := gplan-dev.img

VERSION  := $(shell jq -r '.version' package.json)
PY_VERSION  := $(shell jq -r '.version' package.json | sed -E 's|([0-9]+)\.([0-9]+)\.([0-9]+)(-(b)eta\.(.*))?|\1.\2.\3\5\6|g')
PKG_NAME := dist/bbctrl-$(PY_VERSION).tar.bz2
FINAL_PKG_NAME := dist/onefinity-$(VERSION).tar.bz2

SUBPROJECTS := avr boot pwr

ifndef HOST
HOST=onefinity
endif

ifndef PASSWORD
PASSWORD=onefinity
endif

all: $(HTML) $(RESOURCES)
	@for SUB in $(SUBPROJECTS); do $(MAKE) -C src/$$SUB; done

# !
all: $(HTML_NETWORK) $(RESOURCES)
	@for SUB in $(SUBPROJECTS); do $(MAKE) -C src/$$SUB; done
all: $(HTML_CONFIG) $(RESOURCES)
	@for SUB in $(SUBPROJECTS); do $(MAKE) -C src/$$SUB; done
all: $(HTML_DONE) $(RESOURCES)
	@for SUB in $(SUBPROJECTS); do $(MAKE) -C src/$$SUB; done
all: $(HTML_GETSTART) $(RESOURCES)
	@for SUB in $(SUBPROJECTS); do $(MAKE) -C src/$$SUB; done

pkg: all $(AVR_FIRMWARE) bbserial
	./setup.py sdist
	mv $(PKG_NAME) $(FINAL_PKG_NAME)

bbserial:
	$(MAKE) -C src/bbserial

gplan: $(GPLAN_TARGET)

$(GPLAN_TARGET): $(GPLAN_MOD)
	cp $< $@

$(GPLAN_MOD): $(GPLAN_IMG)
	./scripts/gplan-init-build.sh
	cp ./scripts/gplan-build.sh rpi-share/
	chmod +x rpi-share/gplan-build.sh
	sudo ./scripts/rpi-chroot.sh $(GPLAN_IMG) /mnt/host/gplan-build.sh

$(GPLAN_IMG):
	./scripts/gplan-init-build.sh

.PHONY: $(AVR_FIRMWARE)
$(AVR_FIRMWARE):
	$(MAKE) -C src/avr

update: pkg
	curl -i -X PUT -H "Content-Type: multipart/form-data" \
	  -F "firmware=@$(FINAL_PKG_NAME)" -F "password=$(PASSWORD)" \
	  http://$(HOST)/api/firmware/update
	@-tput sgr0 && echo # Fix terminal output

build/templates.pug: $(TEMPLS)
	mkdir -p build
	cat $(TEMPLS) >$@

node_modules: package.json
	npm install && touch node_modules

$(TARGET_DIR)/%: src/resources/%
	install -D $< $@

src/svelte-components/dist/%:
	cd src/svelte-components && rm -rf dist && npm run build

$(TARGET_DIR)/index.html: build/templates.pug
$(TARGET_DIR)/index.html: $(wildcard src/static/js/*)
$(TARGET_DIR)/index.html: $(wildcard src/static/css/*)
$(TARGET_DIR)/index.html: $(wildcard src/pug/templates/*)
$(TARGET_DIR)/index.html: $(wildcard src/js/*)
$(TARGET_DIR)/index.html: $(wildcard src/stylus/*)
$(TARGET_DIR)/index.html: src/resources/config-template.json
$(TARGET_DIR)/index.html: $(wildcard src/resources/onefinity*defaults.json)
$(TARGET_DIR)/index.html: $(wildcard src/svelte-components/dist/*)
# ?
$(TARGET_DIR)/network.html: build/templates.pug
$(TARGET_DIR)/network.html: $(wildcard src/static/js/*)
$(TARGET_DIR)/network.html: $(wildcard src/static/css/*)
$(TARGET_DIR)/network.html: $(wildcard src/pug/templates/*)
$(TARGET_DIR)/network.html: $(wildcard src/js/*)
$(TARGET_DIR)/network.html: $(wildcard src/stylus/*)
$(TARGET_DIR)/network.html: src/resources/config-template.json
$(TARGET_DIR)/network.html: $(wildcard src/resources/onefinity*defaults.json)
$(TARGET_DIR)/network.html: $(wildcard src/svelte-components/dist/*)

$(TARGET_DIR)/defaultConfig.html: build/templates.pug
$(TARGET_DIR)/defaultConfig.html: $(wildcard src/static/js/*)
$(TARGET_DIR)/defaultConfig.html: $(wildcard src/static/css/*)
$(TARGET_DIR)/defaultConfig.html: $(wildcard src/pug/templates/*)
$(TARGET_DIR)/defaultConfig.html: $(wildcard src/js/*)
$(TARGET_DIR)/defaultConfig.html: $(wildcard src/stylus/*)
$(TARGET_DIR)/defaultConfig.html: src/resources/config-template.json
$(TARGET_DIR)/defaultConfig.html: $(wildcard src/resources/onefinity*defaults.json)
$(TARGET_DIR)/defaultConfig.html: $(wildcard src/svelte-components/dist/*)

$(TARGET_DIR)/getStarted.html: build/templates.pug
$(TARGET_DIR)/getStarted.html: $(wildcard src/static/js/*)
$(TARGET_DIR)/getStarted.html: $(wildcard src/static/css/*)
$(TARGET_DIR)/getStarted.html: $(wildcard src/pug/templates/*)
$(TARGET_DIR)/getStarted.html: $(wildcard src/js/*)
$(TARGET_DIR)/getStarted.html: $(wildcard src/stylus/*)
$(TARGET_DIR)/getStarted.html: src/resources/config-template.json
$(TARGET_DIR)/getStarted.html: $(wildcard src/resources/onefinity*defaults.json)
$(TARGET_DIR)/getStarted.html: $(wildcard src/svelte-components/dist/*)


# $(TARGET_DIR)/done.html: build/templates.pug
# $(TARGET_DIR)/done.html: $(wildcard src/static/js/*)
# $(TARGET_DIR)/done.html: $(wildcard src/static/css/*)
# $(TARGET_DIR)/done.html: $(wildcard src/pug/templates/*)
# $(TARGET_DIR)/done.html: $(wildcard src/js/*)
# $(TARGET_DIR)/done.html: $(wildcard src/stylus/*)
# $(TARGET_DIR)/done.html: src/resources/config-template.json
# $(TARGET_DIR)/done.html: $(wildcard src/resources/onefinity*defaults.json)
# $(TARGET_DIR)/done.html: $(wildcard src/svelte-components/dist/*)



FORCE:

$(TARGET_DIR)/%.html: src/pug/%.pug node_modules FORCE
	cd src/svelte-components && rm -rf dist && npm run build
	@mkdir -p $(TARGET_DIR)/svelte-components
	cp src/svelte-components/dist/* $(TARGET_DIR)/svelte-components/

	@mkdir -p $(TARGET_DIR)
	$(PUG) -O pug-opts.js -P $< -o $(TARGET_DIR) || (rm -f $@; exit 1)

clean:
	rm -rf rpi-share
	git clean -fxd

.PHONY: all install clean tidy pkg gplan lint pylint jshint bbserial