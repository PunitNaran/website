---
draft: true
title: Configurable in Go
date: 2021-02-26T11:41:40.336Z
lastmod: 2021-02-26T11:41:40.421Z
author: Punit Naran
cover: /img/witch-learning.svg
categories:
  - Go
tags:
  - Configurable
  - Go
  - YAML
---
# Go Configurable

This mostly relates to Go Design Patterns, a simple organized approach in making an application run smoothly. I would recommend this to everyone that has been `hardcoding` values in their source code. For example, when you need to pass in an address to connect to a database, or when you need to pass in user details, or some metadata in to an application, you can do this easily without affecting your code. The biggest advantage for this is, when you need to unit test your source code all you'd need to do is read in your test file and start testing. These configurable file can be used for unit tests, system tests and integration tests, and have may more advantages!

Lets get to it!

For this post I'm going to create a YAML file which contains User Details. You can use any human-readable data language of your choice.

The User Details will store detail information about a user, lets assume a user signs up to a dating platform or any other social networking website some details mentioned in the `user` package might need to be obtained to register the user and authenticate them.

```go
package user

// User details required to create user
type User struct {
	Profile     Profile   `yaml:"profile"`
	Gender      Gender    `yaml:"gender"`
	Ethnicity   Ethnicity `yaml:"ethnicity"`
	Country     string    `yaml:"country"`
	Religon     Religon   `yaml:"religon"`
	Personality []string  `yaml:"personality"` // tags of words
	Age         Age       `yaml:"age"`
	Height      int       `yaml:"height"` // Height in CM
	Sexuality   Sexuality `yaml:"sexuality"`
}

// Profile a profile of the user
type Profile struct {
	AvatarName   string       `yaml:"avatar_name"`
	Initals      string       `yaml:"initals"`
	Verification Verification `yaml:"verification"`
}

// Gender the users gender
type Gender struct {
	Male   bool `yaml:"male"`
	Female bool `yaml:"female"`
}

// Ethnicity the users ethnicity
type Ethnicity struct {
	ethnicGroup map[string]string `yaml:"ethnic_group"`
	/*
		White
			English / Welsh / Scottish / Northern Irish / British
			Irish
			Gypsy or Irish Traveller
			Any other White background
		Mixed / Multiple ethnic groups
			White and Black Caribbean
			White and Black African
			White and Asian
			Any other Mixed / Multiple ethnic background
		Asian
			Indian
			Pakistani
			Bangladeshi
			Chinese
			Any other Asian background
		Black
			African
			Caribbean
			Other
		Other
			Arab
			Any other ethnic group
	*/
}

// Religon the users religon
type Religon struct {
	Any          bool      `yaml:"any"`
	Christian    Christian `yaml:"christian"`
	Islam        Islam     `yaml:"islam"`
	Agnostic     bool      `yaml:"agnostic"`
	Nonreligious bool      `yaml:"nonreligious"`
	Hinduism     Hinduism  `yaml:"hinduism"`
	Confucianism bool      `yaml:"confucianism"`
	Taoism       bool      `yaml:"taoism"`
	Buddhism     Buddhism  `yaml:"buddhism"`
	Sikhism      bool      `yaml:"sikhism"`
	Juche        bool      `yaml:"juche"`
	Spiritism    bool      `yaml:"spiritism"`
	Judaism      bool      `yaml:"judaism"`
	Bahai        bool      `yaml:"bahai"`
	Jainism      bool      `yaml:"jainism"`
	Shinto       bool      `yaml:"shinto"`
	CaoDai       bool      `yaml:"caoDai"`
	Other        bool      `yaml:"other"`
}

// Buddhism type of buddist
type Buddhism struct {
	Community string `yaml:"community"`
}

// Christian type of christan
type Christian struct {
	Community string `yaml:"community"`
}

// Hinduism type of Hindu
type Hinduism struct {
	Community string `yaml:"community"`
}

// Islam type of islam
type Islam struct {
	Community string `yaml:"community"`
}

// Age type of age
type Age struct {
	Day   int32 `yaml:"day"`
	Month int32 `yaml:"month"`
	Year  int32 `yaml:"year"`
}

// Verification confirms users identity
type Verification struct {
	EncryptedEmail    string `yaml:"encrypted_email"`
	EncryptedMobileNo string `yaml:"encrypted_mobile_number"`
	EncryptedPass     string `yaml:"encrypted_pass"`
	IncorrectCounts   uint8  `yaml:"incorrect_counts"`
}

// Sexuality the users sexuality
type Sexuality struct {
	Heterosexual bool `yaml:"heterosexual"`
	Homosexual   bool `yaml:"homosexual"`
	Bisexual     bool `yaml:"bisexual"`
}
```

Here I have created a number of structures, the `User` is the main structure consisting of a `Profile`, `Gender`, `Ethnicity`, `Country`, `Religion`, `Personality`, `Age`, `Height` and `Sexuality`

- Profile has:
    - An avatar name so the users name will be kept hidden
    - Initals of the user
    - Verification another structure that will be the users login details

- Gender has:
    - Specifies the users Gender

- Ethnicity has:
    - A map, this is quite vaige but in this map we can specify any string if we are not too careful. However, it can be expected that we store something like `Key: 'mixed' = 'Black Caribbean'`  

- Religon has:
    - A number of religions some are more detailed and some are just `true` and `false`. 

```go
func main() {
	// get Current working directory
	cwdir, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}
	// read the new users profile
	testdata := cwdir + "/../lib/user/testdata/user.yaml"
	userdata := readYamlFile(testdata)
	userDetails := readUserProfile(data)
// ....... Other code
}
```

In the code above, I've specified where my user details yaml file exists. Its good to use `os.Getwd()` because if run your application in another system or as a docker container it will always point to the current working directory specific to the system.

```go
func readYamlFile(path string) []byte {
	yamlFile, err := ioutil.ReadFile(path)
	if err != nil {
		log.Printf("yamlFile.Get err   #%v ", err)
	}
	return yamlFile
}

func readUserProfile(yamlFile []byte) *user.User {
	userDetails := &user.User{}
	err := yaml.Unmarshal(yamlFile, userDetails)
	if err != nil {
		log.Fatalf("Unmarshal: %v", err)
	}
	return userDetails
}
```