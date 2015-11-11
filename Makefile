VERISON = latest

.PHONY: build push test

build:
	sudo docker build -t thedillonb/codehub-push:$(VERISON) .
push: build
	sudo docker push thedillonb/codehub-push:$(VERISON)
test:
	mocha
