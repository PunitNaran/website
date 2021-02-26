---
draft: false
title: Configurable in Go
date: 2021-02-26T14:18:54.530Z
lastmod: 2021-02-26T14:18:55.178Z
author: Punit Naran
cover: /img/witch-learning.svg
categories:
  - Go
tags:
  - Configurable
  - Go
  - YAML
  - Beginner
---
# Go Configurable

This mostly relates to Go Design Patterns, a simple organized approach in making an application run smoothly. I would recommend this to everyone that has been `hardcoding` values in their source code. For example, when you need to pass in an address to connect to a database, or when you need to pass in user details, or some metadata in to an application, you can do this easily without affecting your code. The biggest advantage for this is, when you need to unit test your source code all you'd need to do is read in your test file and start testing. These configurable file can be used for unit tests, system tests and integration tests, and have may more advantages!

Lets get to it!

For this post I'm going to create a YAML file which contains User Details. You can use any human-readable data language of your choice.

The User Details will store detailed information about a user. Lets assume a user signs up to a dating platform or any other social networking website some details mentioned in the `user` package might need to be obtained to register and setup the user, as well as to authenticate the user. 

```go
package user

// User details required to create user
type User struct {
	Profile     Profile   `yaml:"profile"`
	Gender      Gender    `yaml:"gender"`
	Ethnicity   Ethnicity `yaml:"ethnicity"`
	Country     string    `yaml:"country"`
	Religion     Religion   `yaml:"religion"`
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
	EthnicGroup map[string]string `yaml:"ethnic_group"`
	/*
		White
			English / Welsh / Scottish / Northern Irish / British
			Irish
			Gypsy or Irish Traveler
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

// Religion the users Religion
type Religion struct {
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

Here I have created a number of structures, the `User` is the main structure consisting of a `Profile`, `Gender`, `Ethnicity`, `Country`, `Religion`, `Personality`, `Age`, `Height` and `Sexuality`. The nested structures will be identified by YAML when unmarshalling and marshaling.

* Profile has:

  * An avatar name so the users name will be kept hidden
  * Initials of the user
  * Verification another structure that will be the users login details
* Gender has:

  * Specifies the users Gender
* Ethnicity has:

  * A map, this is quite vague but in this map we can specify any string if we are not too careful. However, it can be expected that we store something like `Key: 'mixed' = 'Black Caribbean'`  
* Religion has:

  * A number of religions a user selects some are structures containing a string of religions views this can be something like `catholic` and some are just `true` and `false` values. 
* Age has:

  * Users date of birth
* Verification has:

  * Stores the users login credentials
  * Number of incorrect logins (Can use used in the source code for triggering a forgot user login)
* Sexuality has:

  * Users sexuality

As you could see we need to specify flags like `yaml:"encrypted_email"`, we could even have more tags in our flags like `yaml:"hinduism,omitempty"` or more flags with tags like `yaml:"religion", xml:"religion,attr" json:"religion"`

The `omitempty` is the "" for a string. For maps, slices and pointers it’s would be a `nil`.

Additional flags would allow you to read in different human-readable data languages, but you'd also need to implement the marshaling and unmarishaling in your source code shown similarly below for only YAML.

Now lets implement a reader. The reader would read in a file and convert it into bytes. After we have read in our file we want check if the file is correctly formatted the YAML go package `gopkg.in/yaml.v2` already has a unmarshaller which we can use this will decode the data to populate our variable `userDetails` of type `User`.

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

By calling the `readYamlFile` and passing in a file path we return a raw data which is represented as bytes. 

Note: I've call a `log.Printf` when there is an error, this can be a `log.Fatal`.

Next we can pass in our raw data into our `readUserProfile` function. If YAML file is formatted correctly we are able to populate our User Details.

We can marshal this by calling `myData, err := yaml.Marshal(userDetails)`. `myData` then can be written to file.

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

In the code above, I've specified where my user details YAML file exists. Its good to use `os.Getwd()` because if run the application in another system or in a docker container it will always point to the current working directory specific to the system.

Finally we are done! We read in what we need to and now we can do something with our data.

I've used this example as it may be quite easier to understand for beginners. If needed to optimize our source code like using a number of Channels (Workers), and Go routines (Stages), have a buffer pool size, create a server with a timeouts or tls configurations and more. We can do this by creating a configurable file and running our application which will read the configurations and scale our application as needed.

An example of what our YAML file would look like: 

```yaml
profile:
  avatar_name: dean
  initals: pn
  verification:
      encrypted_email: chocolates@punitnaran.com
      encrypted_mobile_number: +44712345678
      encrypted_pass: panipuri
      incorrect_counts: 0
gender:
  male: true
  female: false
ethnicity:
  ethnic_group:
    asian:
      - Indian
    black:
    mixed:
    white:
    other:
country: "United Kingdom"
religion:
  any: true
  christian:
    community:
  islam:
    community:
  agnostic: false
  nonreligious: false
  hinduism:
    community: 
  confucianism: false
  taoism: false
  buddhism:
    community:
  sikhism: false
  juche: false
  spiritism: false
  judaism: false
  bahai: false
  jainism: false
  shinto: false
  caoDai: false
  other: false
personality: ['developer', 'foodie', 'sleepy']
age:
  day: 1
  month: 11
  year: 1993
height: 181
sexuality:
  heterosexual: true
  homosexual: false
  bisexual: false
```